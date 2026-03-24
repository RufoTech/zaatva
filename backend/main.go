package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"firebase.google.com/go/v4/messaging"
	"google.golang.org/api/option"
)

var (
	firebaseAuth    *auth.Client
	firestoreClient *firestore.Client
	messagingClient *messaging.Client
)

// Data Structures
type WeekItem struct {
	Day        int         `firestore:"day" json:"day"`
	ExtraCount int         `firestore:"extraCount" json:"extraCount"`
	ID         interface{} `firestore:"id" json:"id"` // String və ya Number ola bilər
	Images     []string    `firestore:"images" json:"images"`
	Subtitle   string      `firestore:"subtitle" json:"subtitle"`
	Title      string      `firestore:"title" json:"title"`
	Type       string      `firestore:"type" json:"type"`
}

type ProgramWeeksDoc struct {
	CreatedAt interface{}           `firestore:"createdAt" json:"createdAt"`
	UserID    string                `firestore:"userId" json:"userId"`
	Weeks     map[string][]WeekItem `firestore:"weeks" json:"weeks"`
	Name      string                `json:"name"` // user_programs kolleksiyasından gələn ad
}

type MuscleGroup struct {
	Name     string `firestore:"name" json:"name"`
	ImageURL string `firestore:"imageUrl" json:"imageUrl"`
}

type Movement struct {
	Category     string        `firestore:"category" json:"category"`
	ExerciseID   string        `firestore:"exerciseId" json:"exerciseId"`
	Name         string        `firestore:"name" json:"name"`
	Reps         interface{}   `firestore:"reps" json:"reps"`
	SetsCount    interface{}   `firestore:"setsCount" json:"setsCount"`
	VideoURL     string        `firestore:"videoUrl" json:"videoUrl"`
	MuscleGroups []MuscleGroup `firestore:"muscleGroups" json:"muscleGroups"`
	MainImage    string        `firestore:"mainImage" json:"mainImage"`
	ImageURL     string        `firestore:"imageUrl" json:"imageUrl"`
	Instructions string        `firestore:"instructions" json:"instructions"`
}

type WorkoutSet struct {
	Label     string     `firestore:"label" json:"label"`
	Movements []Movement `firestore:"movements" json:"movements"`
	Rest      string     `firestore:"rest" json:"rest"`
}

type ExerciseBlock struct {
	Sets []WorkoutSet `firestore:"sets" json:"sets"`
}

type WorkoutPlanResponse struct {
	Name      string          `json:"name"`
	Exercises []ExerciseBlock `json:"exercises"`
}

// authMiddleware gələn sorğulardakı Firebase ID Token-i yoxlayır
func authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// CORS Headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// "Authorization: Bearer <token>" başlığını (header) alırıq
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Authorization başlığı tapılmadı", http.StatusUnauthorized)
			return
		}

		// Token hissəsini ayırırıq
		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || strings.ToLower(tokenParts[0]) != "bearer" {
			http.Error(w, "Yanlış Authorization formatı. 'Bearer <token>' olmalıdır", http.StatusUnauthorized)
			return
		}
		idToken := tokenParts[1]

		// Token-i Firebase ilə doğrulayırıq
		token, err := firebaseAuth.VerifyIDToken(context.Background(), idToken)
		if err != nil {
			http.Error(w, fmt.Sprintf("Token etibarsızdır: %v", err), http.StatusUnauthorized)
			return
		}

		// Token-i context-ə əlavə edirik ki, handler-lər istifadə edə bilsin
		ctx := context.WithValue(r.Context(), "userToken", token)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

// Firestore-dan sənədi retry ilə oxuyan helper funksiya
func getDocumentWithRetry(ctx context.Context, docRef *firestore.DocumentRef) (*firestore.DocumentSnapshot, error) {
	var err error
	var doc *firestore.DocumentSnapshot

	for i := 0; i < 3; i++ {
		doc, err = docRef.Get(ctx)
		if err == nil {
			return doc, nil
		}
		
		errMsg := err.Error()
		if strings.Contains(errMsg, "Unavailable") || strings.Contains(errMsg, "forcibly closed") || strings.Contains(errMsg, "transport is closing") {
			log.Printf("Retrying Firestore Get due to error: %v (Attempt %d/3)", err, i+1)
			time.Sleep(500 * time.Millisecond)
			continue
		}
		
		// Digər xətalar (məsələn NotFound) dərhal qaytarılır
		return nil, err
	}
	return nil, err
}

// getProgramWeeksHandler proqramın həftəlik məlumatlarını qaytarır
func getProgramWeeksHandler(w http.ResponseWriter, r *http.Request) {
	// Query parametrlərindən programId-ni alırıq
	programId := r.URL.Query().Get("programId")
	if programId == "" {
		http.Error(w, "programId parametri tələb olunur", http.StatusBadRequest)
		return
	}

	// Context-dən user tokenini alırıq (authMiddleware-dən gəlir)
	token := r.Context().Value("userToken").(*auth.Token)
	uid := token.UID

	ctx := context.Background()

	// Firestore-dan sənədi oxuyuruq
	log.Printf("Firestore request for doc: %s", programId)
	
	// RETRY İLƏ ÇAĞIRIŞ
	doc, err := getDocumentWithRetry(ctx, firestoreClient.Collection("user_program_weeks").Doc(programId))
	
	if err != nil {
		log.Printf("Firestore Get error: %v", err)
		// Sənəd tapılmadıqda 404 qaytar
		if strings.Contains(err.Error(), "NotFound") {
			http.Error(w, "Proqram tapılmadı", http.StatusNotFound)
			return
		}
		http.Error(w, fmt.Sprintf("Firestore xətası: %v", err), http.StatusInternalServerError)
		return
	}

	var data ProgramWeeksDoc
	if err := doc.DataTo(&data); err != nil {
		log.Printf("DataTo error: %v", err)
		// Fallback: Try to load into map to see what fields are problematic
		var rawData map[string]interface{}
		if err2 := doc.DataTo(&rawData); err2 == nil {
			log.Printf("Raw data loaded successfully (for debug): %+v", rawData)
			
			// Xüsusilə 'weeks' sahəsini yoxlayaq
			if weeksVal, ok := rawData["weeks"]; ok {
				log.Printf("'weeks' sahəsinin tipi: %T", weeksVal)
				log.Printf("'weeks' sahəsinin dəyəri: %+v", weeksVal)
			} else {
				log.Printf("'weeks' sahəsi tapılmadı!")
			}
		}
		http.Error(w, fmt.Sprintf("Data parse xətası: %v", err), http.StatusInternalServerError)
		return
	}

	// Təhlükəsizlik yoxlaması: Bu proqram həqiqətən bu istifadəçiyə aiddir?
	if data.UserID != uid {
		http.Error(w, "Bu məlumatı görmək üçün icazəniz yoxdur", http.StatusForbidden)
		return
	}

	// Proqramın əlavə məlumatlarını (məs: name) user_programs-dan çəkirik
	progDoc, err := firestoreClient.Collection("user_programs").Doc(programId).Get(ctx)
	if err == nil {
		if progData := progDoc.Data(); progData != nil {
			if name, ok := progData["name"].(string); ok {
				data.Name = name
			}
		}
	} else {
		log.Printf("Program info fetch error (skipping name): %v", err)
	}

	// ----------------------------------------------------------------------
	for weekKey, weekItems := range data.Weeks {
		for i, item := range weekItems {
			if len(item.Images) > 0 {
				var cleanImages []string
				for _, img := range item.Images {
					// Backtick (`), tek tırnak ('), çift tırnak (") ve boşlukları temizle
					cleanImg := strings.Trim(img, " `\"'")
					if cleanImg != "" {
						cleanImages = append(cleanImages, cleanImg)
					}
				}
				// Temizlenmiş listeyi geri ata
				data.Weeks[weekKey][i].Images = cleanImages
			}
		}
	}
	// ----------------------------------------------------------------------

	// JSON olaraq qaytarırıq
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(data); err != nil {
		http.Error(w, fmt.Sprintf("JSON encode xətası: %v", err), http.StatusInternalServerError)
	}
}

func cleanString(s string) string {
	return strings.Trim(s, " `\"'\n\r\t")
}

// getWorkoutPlanHandler məşq planını və detallarını qaytarır
func getWorkoutPlanHandler(w http.ResponseWriter, r *http.Request) {
	workoutId := r.URL.Query().Get("workoutId")
	log.Printf("getWorkoutPlanHandler CALLED with workoutId: %s", workoutId)

	if workoutId == "" {
		http.Error(w, "workoutId parametri tələb olunur", http.StatusBadRequest)
		log.Println("Error: workoutId is empty")
		return
	}

	ctx := context.Background()
	log.Printf("Fetching workout plan for ID: %s", workoutId)

	// 1. Məşq planını 'workout_programs' və ya fallback olaraq 'workouts' kolleksiyasından tapırıq
	var planDoc *firestore.DocumentSnapshot
	var err error

	log.Println("Checking 'workout_programs' collection...")
	planDoc, err = getDocumentWithRetry(ctx, firestoreClient.Collection("workout_programs").Doc(workoutId))
	
	if err != nil || !planDoc.Exists() {
		log.Printf("Not found in 'workout_programs' (err: %v). Checking 'customUserWorkouts'...", err)
		// Fallback 1: 'customUserWorkouts' kolleksiyasını yoxla (User-in yaratdığı məşqlər)
		planDoc, err = getDocumentWithRetry(ctx, firestoreClient.Collection("customUserWorkouts").Doc(workoutId))
	}

	if err != nil || !planDoc.Exists() {
		log.Printf("Not found in 'customUserWorkouts' (err: %v). Checking 'workouts'...", err)
		// Fallback 2: 'workouts' kolleksiyasını yoxla
		planDoc, err = getDocumentWithRetry(ctx, firestoreClient.Collection("workouts").Doc(workoutId))
	}

	if err != nil || !planDoc.Exists() {
		log.Printf("Workout plan not found in either collection for ID: %s", workoutId)
		http.Error(w, "Workout plan not found", http.StatusNotFound)
		return
	}

	planData := planDoc.Data()
	log.Printf("Plan data found. Raw data keys: %v", getKeys(planData))

	workoutName, _ := planData["name"].(string)
	if workoutName == "" {
		workoutName, _ = planData["title"].(string)
	}
	if workoutName == "" {
		workoutName = "Workout"
	}
	log.Printf("Workout Name: %s", workoutName)

	// 2. Hərəkətlərin siyahısını alırıq (NEW STRUCTURE)
	// Structure is: exercises (array) -> sets (array) -> movements (array)
	rawExercises, ok := planData["exercises"].([]interface{})
	if !ok {
		log.Println("Warning: 'exercises' field is missing or not an array")
		rawExercises = []interface{}{}
	}
	log.Printf("Found %d exercise blocks in plan", len(rawExercises))

	var detailedBlocks []ExerciseBlock

	// Iterate over Blocks
	for i, rawBlock := range rawExercises {
		blockMap, ok := rawBlock.(map[string]interface{})
		if !ok {
			log.Printf("Block #%d is not a map, skipping", i)
			continue
		}
		
		rawSets, ok := blockMap["sets"].([]interface{})
		if !ok {
			log.Printf("Block #%d has no valid sets, skipping", i)
			continue
		}

		var detailedSets []WorkoutSet

		// Iterate over Sets
		for _, rawSet := range rawSets {
			setMap, ok := rawSet.(map[string]interface{})
			if !ok {
				continue
			}
			
			label, _ := setMap["label"].(string)
			rest, _ := setMap["rest"].(string) // or int to string conversion if needed
			
			rawMovements, ok := setMap["movements"].([]interface{})
			if !ok {
				continue
			}

			var detailedMovements []Movement

			// Iterate over Movements
			for _, rawMov := range rawMovements {
				movMap, ok := rawMov.(map[string]interface{})
				if !ok {
					continue
				}

				exName, _ := movMap["name"].(string)
				exId, _ := movMap["exerciseId"].(string)
				category, _ := movMap["category"].(string)
				reps := movMap["reps"]
				setsCount := movMap["setsCount"]

				log.Printf("Processing movement: %s (ID: %s)", exName, exId)

				// Fetch details from 'workouts' collection
				// Try by ID first if available
				var detail Movement // Reuse Movement struct for temp storage of details
				var docSnaps []*firestore.DocumentSnapshot

				if exId != "" {
					docSnap, err := firestoreClient.Collection("workouts").Doc(exId).Get(ctx)
					if err == nil && docSnap.Exists() {
						docSnaps = []*firestore.DocumentSnapshot{docSnap}
					}
				}

				// Fallback to name search if ID failed
				if len(docSnaps) == 0 && exName != "" {
					iter := firestoreClient.Collection("workouts").Where("name", "==", exName).Limit(1).Documents(ctx)
					docSnaps, _ = iter.GetAll()
				}

				if len(docSnaps) > 0 {
					// Map fields manually or use DataTo with a compatible struct
					// Using a temp struct or map to avoid overwriting existing Movement struct if types differ slightly
					// But let's assume 'workouts' doc matches closely enough or we map manually
					data := docSnaps[0].Data()
					
					// Extract details
					if val, ok := data["videoUrl"].(string); ok { detail.VideoURL = cleanString(val) }
					if val, ok := data["mainImage"].(string); ok { detail.MainImage = cleanString(val) }
					if val, ok := data["imageUrl"].(string); ok { detail.ImageURL = cleanString(val) }
					if val, ok := data["instructions"].(string); ok { detail.Instructions = val }
					
					// Muscle Groups
					if mgRaw, ok := data["muscleGroups"].([]interface{}); ok {
						for _, mgItem := range mgRaw {
							if mgMap, ok := mgItem.(map[string]interface{}); ok {
								name, _ := mgMap["name"].(string)
								img, _ := mgMap["imageUrl"].(string)
								detail.MuscleGroups = append(detail.MuscleGroups, MuscleGroup{Name: name, ImageURL: cleanString(img)})
							}
						}
					}
				}

				// Construct final movement
				finalMov := Movement{
					Category:     category,
					ExerciseID:   exId,
					Name:         exName,
					Reps:         reps,
					SetsCount:    setsCount,
					VideoURL:     detail.VideoURL,
					MuscleGroups: detail.MuscleGroups,
					MainImage:    detail.MainImage,
					ImageURL:     detail.ImageURL,
					Instructions: detail.Instructions,
				}
				
				// Fallback for image if not in detailed fetch but in plan (custom uploaded)
				if planImg, ok := movMap["image"].(string); ok && planImg != "" {
					finalMov.ImageURL = planImg
					finalMov.MainImage = planImg
				}

				detailedMovements = append(detailedMovements, finalMov)
			}
			
			detailedSets = append(detailedSets, WorkoutSet{
				Label:     label,
				Rest:      rest,
				Movements: detailedMovements,
			})
		}
		
		detailedBlocks = append(detailedBlocks, ExerciseBlock{Sets: detailedSets})
	}

	response := WorkoutPlanResponse{
		Name:      workoutName,
		Exercises: detailedBlocks,
	}

	log.Printf("Sending response with %d exercise blocks", len(detailedBlocks))
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("JSON encode error: %v", err)
		http.Error(w, fmt.Sprintf("JSON encode xətası: %v", err), http.StatusInternalServerError)
	}
}

func getKeys(m map[string]interface{}) []string {
    keys := make([]string, 0, len(m))
    for k := range m {
        keys = append(keys, k)
    }
    return keys
}

// secureDataHandler yalnız doğrulanan istifadəçilərə məlumat qaytarır
func secureDataHandler(w http.ResponseWriter, r *http.Request) {
	// Bura yalnız token-i düzgün olanlar girə bilər!
	// Gələcəkdə burada Firestore-dan məlumat çəkəcəyik
	fmt.Fprintf(w, "Təbrik edirik! Siz Firebase ilə təsdiqlənmiş istifadəçisiniz. Budur sizin gizli məlumatlarınız.")
}

// createCustomWorkoutHandler handles creating a new custom workout
func createCustomWorkoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Only POST method is allowed", http.StatusMethodNotAllowed)
		return
	}

	token := r.Context().Value("userToken").(*auth.Token)
	uid := token.UID

	var payload struct {
		Name          string        `json:"name"`
		Level         string        `json:"level"`
		TargetMuscles []string      `json:"targetMuscles"`
		Equipment     []string      `json:"equipment"`
		Duration      string        `json:"duration"`
		CoverImage    string        `json:"coverImage"`
		Exercises     []interface{} `json:"exercises"` // We'll store this as raw JSON/Map in Firestore
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	if payload.Name == "" {
		http.Error(w, "Program name is required", http.StatusBadRequest)
		return
	}

	// Prepare data for Firestore
	workoutData := map[string]interface{}{
		"userId":            uid,
		"name":              payload.Name,
		"level":             payload.Level,
		"targetMuscles":     payload.TargetMuscles,
		"equipment":         payload.Equipment,
		"duration":          payload.Duration,
		"coverImage":        payload.CoverImage,
		"exercises":         payload.Exercises,
		"workoutTarget":     "Custom",
		"workout_type_name": "Custom",
		"createdAt":         time.Now().Format(time.RFC3339),
		"isCustom":          true,
	}

	ctx := context.Background()
	docRef, _, err := firestoreClient.Collection("customUserWorkouts").Add(ctx, workoutData)
	if err != nil {
		log.Printf("Error creating custom workout: %v", err)
		http.Error(w, "Failed to save workout", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Workout created successfully",
		"id":      docRef.ID,
	})
}

// shareProgramToCommunityHandler shares a user program to the community marketplace
func shareProgramToCommunityHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Only POST method is allowed", http.StatusMethodNotAllowed)
		return
	}

	token := r.Context().Value("userToken").(*auth.Token)
	uid := token.UID

	var payload struct {
		OriginalId    string `json:"originalId"`
		AuthorName    string `json:"authorName"`
		Title         string `json:"title"`
		Focus         string `json:"focus"`
		CoverImage    string `json:"coverImage"`
		WorkoutCount  int    `json:"workoutCount"`
		TotalDuration int    `json:"totalDuration"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	if payload.OriginalId == "" || payload.Title == "" {
		http.Error(w, "originalId and title are required", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	// 0. Check maximum share limit (5 items max)
	iter := firestoreClient.Collection("community_shared_programs").Where("authorId", "==", uid).Documents(ctx)
	snaps, err := iter.GetAll()
	if err != nil {
		log.Printf("Error counting shared programs: %v", err)
		http.Error(w, "Failed to verify share limits", http.StatusInternalServerError)
		return
	}
	if len(snaps) >= 5 {
		http.Error(w, "Maksimum 5 ədəd paylaşa bilərsiniz", http.StatusForbidden)
		return
	}

	// Fetch weeks data directly from database on backend
	weeksDoc, err := firestoreClient.Collection("user_program_weeks").Doc(payload.OriginalId).Get(ctx)
	var weeksData interface{}
	
	if err == nil && weeksDoc.Exists() {
	    if data := weeksDoc.Data(); data != nil {
	        if w, ok := data["weeks"]; ok {
	            weeksData = w
	        }
	    }
	} else {
	    // Fallback if not found in user_program_weeks
	    progDoc, err := firestoreClient.Collection("user_programs").Doc(payload.OriginalId).Get(ctx)
	    if err == nil && progDoc.Exists() {
	        if data := progDoc.Data(); data != nil {
	            if w, ok := data["weeks"]; ok {
	                weeksData = w
	            }
	        }
	    }
	}
	
	if weeksData == nil {
	    weeksData = make(map[string]interface{})
	}

	// Prepare data for community_shared_programs
	sharedData := map[string]interface{}{
		"originalId":    payload.OriginalId,
		"authorId":      uid,
		"authorName":    payload.AuthorName,
		"title":         payload.Title,
		"focus":         payload.Focus,
		"coverImage":    payload.CoverImage,
		"workoutCount":  payload.WorkoutCount,
		"totalDuration": payload.TotalDuration,
		"weeks":         weeksData,
		"createdAt":     firestore.ServerTimestamp,
		"downloads":     0,
		"likes":         0,
	}

	docRef, _, err := firestoreClient.Collection("community_shared_programs").Add(ctx, sharedData)
	if err != nil {
		log.Printf("Error sharing program: %v", err)
		http.Error(w, "Failed to share program", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Program shared successfully",
		"id":      docRef.ID,
	})
}

// shareWorkoutToCommunityHandler shares a custom workout to the community marketplace
func shareWorkoutToCommunityHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Only POST method is allowed", http.StatusMethodNotAllowed)
		return
	}

	token := r.Context().Value("userToken").(*auth.Token)
	uid := token.UID

	var payload struct {
		OriginalId   string        `json:"originalId"`
		AuthorName   string        `json:"authorName"`
		Title        string        `json:"title"`
		CoverImage   string        `json:"coverImage"`
		Difficulty   string        `json:"difficulty"`
		Duration     int           `json:"duration"`
		TargetMuscle string        `json:"targetMuscle"`
		Exercises    []interface{} `json:"exercises"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	if payload.OriginalId == "" || payload.Title == "" {
		http.Error(w, "originalId and title are required", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	// 0. Check maximum share limit (5 items max)
	iter := firestoreClient.Collection("community_shared_workouts").Where("authorId", "==", uid).Documents(ctx)
	snaps, err := iter.GetAll()
	if err != nil {
		log.Printf("Error counting shared workouts: %v", err)
		http.Error(w, "Failed to verify share limits", http.StatusInternalServerError)
		return
	}
	if len(snaps) >= 5 {
		http.Error(w, "Maksimum 5 ədəd paylaşa bilərsiniz", http.StatusForbidden)
		return
	}

	// Prepare data for community_shared_workouts
	sharedData := map[string]interface{}{
		"originalId":   payload.OriginalId,
		"authorId":     uid,
		"authorName":   payload.AuthorName,
		"title":        payload.Title,
		"coverImage":   payload.CoverImage,
		"difficulty":   payload.Difficulty,
		"duration":     payload.Duration,
		"targetMuscle": payload.TargetMuscle,
		"exercises":    payload.Exercises,
		"createdAt":    firestore.ServerTimestamp,
		"downloads":    0,
		"likes":        0,
	}

	docRef, _, err := firestoreClient.Collection("community_shared_workouts").Add(ctx, sharedData)
	if err != nil {
		log.Printf("Error sharing workout: %v", err)
		http.Error(w, "Failed to share workout", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Workout shared successfully",
		"id":      docRef.ID,
	})
}

// getCommunityItemsHandler fetches items from the community marketplace
func getCommunityItemsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Only GET method is allowed", http.StatusMethodNotAllowed)
		return
	}

	itemType := r.URL.Query().Get("type")
	if itemType != "programs" && itemType != "workouts" {
		http.Error(w, "type parameter must be 'programs' or 'workouts'", http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	collectionName := "community_shared_programs"
	if itemType == "workouts" {
		collectionName = "community_shared_workouts"
	}

	iter := firestoreClient.Collection(collectionName).OrderBy("createdAt", firestore.Desc).Documents(ctx)
	var items []map[string]interface{}

	for {
		doc, err := iter.Next()
		if err != nil {
			break // End of iterator or error
		}
		data := doc.Data()
		data["id"] = doc.Ref.ID
		items = append(items, data)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// downloadCommunityProgramHandler clones a community program to the user's library
func downloadCommunityProgramHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Only POST method is allowed", http.StatusMethodNotAllowed)
		return
	}

	token := r.Context().Value("userToken").(*auth.Token)
	uid := token.UID

	var payload struct {
		ItemId string `json:"itemId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	if payload.ItemId == "" {
		http.Error(w, "itemId is required", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	// 1. Fetch the shared program
	docSnap, err := firestoreClient.Collection("community_shared_programs").Doc(payload.ItemId).Get(ctx)
	if err != nil {
		log.Printf("Error fetching shared program: %v", err)
		http.Error(w, "Program not found", http.StatusNotFound)
		return
	}

	data := docSnap.Data()

	// Prevent downloading own program
	if data["authorId"] == uid {
		http.Error(w, "You cannot download your own program", http.StatusBadRequest)
		return
	}

	// 2. Clone to user_programs
	newProgramData := map[string]interface{}{
		"userId":          uid,
		"communityItemId": payload.ItemId,
		"name":            data["title"],
		"focus":           data["focus"],
		"coverImage":      data["coverImage"],
		"workoutCount":  data["workoutCount"],
		"totalDuration": data["totalDuration"],
		"difficulty":    "Custom",
		"createdAt":     firestore.ServerTimestamp,
	}

	newProgRef, _, err := firestoreClient.Collection("user_programs").Add(ctx, newProgramData)
	if err != nil {
		http.Error(w, "Failed to create user program", http.StatusInternalServerError)
		return
	}

	// 3. Clone to user_program_weeks
	if weeks, ok := data["weeks"]; ok {
		weekData := map[string]interface{}{
			"userId":    uid,
			"createdAt": firestore.ServerTimestamp,
			"weeks":     weeks,
		}
		_, err = firestoreClient.Collection("user_program_weeks").Doc(newProgRef.ID).Set(ctx, weekData)
		if err != nil {
			log.Printf("Error saving weeks: %v", err)
			// Non-fatal, but log it
		}
	}

	// 4. Increment downloads
	_, err = firestoreClient.Collection("community_shared_programs").Doc(payload.ItemId).Update(ctx, []firestore.Update{
		{Path: "downloads", Value: firestore.Increment(1)},
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Program downloaded successfully",
		"newId":   newProgRef.ID,
	})
}

// downloadCommunityWorkoutHandler clones a community workout to the user's library
func downloadCommunityWorkoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Only POST method is allowed", http.StatusMethodNotAllowed)
		return
	}

	token := r.Context().Value("userToken").(*auth.Token)
	uid := token.UID

	var payload struct {
		ItemId string `json:"itemId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	if payload.ItemId == "" {
		http.Error(w, "itemId is required", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	// 1. Fetch the shared workout
	docSnap, err := firestoreClient.Collection("community_shared_workouts").Doc(payload.ItemId).Get(ctx)
	if err != nil {
		log.Printf("Error fetching shared workout: %v", err)
		http.Error(w, "Workout not found", http.StatusNotFound)
		return
	}

	data := docSnap.Data()

	// Prevent downloading own workout
	if data["authorId"] == uid {
		http.Error(w, "You cannot download your own workout", http.StatusBadRequest)
		return
	}

	// 2. Clone to customUserWorkouts
	newWorkoutData := map[string]interface{}{
		"userId":          uid,
		"communityItemId": payload.ItemId,
		"name":            data["title"],
		"coverImage":      data["coverImage"],
		"difficulty":      data["difficulty"],
		"duration":     data["duration"],
		"targetMuscle": data["targetMuscle"],
		"exercises":    data["exercises"],
		"createdAt":    firestore.ServerTimestamp,
	}

	newWorkRef, _, err := firestoreClient.Collection("customUserWorkouts").Add(ctx, newWorkoutData)
	if err != nil {
		http.Error(w, "Failed to create user workout", http.StatusInternalServerError)
		return
	}

	// 3. Increment downloads
	_, err = firestoreClient.Collection("community_shared_workouts").Doc(payload.ItemId).Update(ctx, []firestore.Update{
		{Path: "downloads", Value: firestore.Increment(1)},
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Workout downloaded successfully",
		"newId":   newWorkRef.ID,
	})
}

// deleteCommunityProgramHandler deletes a community program shared by the user
func deleteCommunityProgramHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete && r.Method != http.MethodPost {
		http.Error(w, "Only POST/DELETE methods are allowed", http.StatusMethodNotAllowed)
		return
	}

	token := r.Context().Value("userToken").(*auth.Token)
	uid := token.UID

	var payload struct {
		ItemId string `json:"itemId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	if payload.ItemId == "" {
		http.Error(w, "itemId is required", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	// 1. Fetch the shared program
	docSnap, err := firestoreClient.Collection("community_shared_programs").Doc(payload.ItemId).Get(ctx)
	if err != nil {
		log.Printf("Error fetching shared program for deletion: %v", err)
		http.Error(w, "Program not found", http.StatusNotFound)
		return
	}

	data := docSnap.Data()

	// 2. Prevent deleting someone else's program
	if data["authorId"] != uid {
		http.Error(w, "You can only delete your own program", http.StatusForbidden)
		return
	}

	// 3. Delete the program
	_, err = firestoreClient.Collection("community_shared_programs").Doc(payload.ItemId).Delete(ctx)
	if err != nil {
		log.Printf("Error deleting shared program: %v", err)
		http.Error(w, "Failed to delete program", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Program deleted successfully",
	})
}

// deleteCommunityWorkoutHandler deletes a custom workout shared by the user
func deleteCommunityWorkoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete && r.Method != http.MethodPost {
		http.Error(w, "Only POST/DELETE methods are allowed", http.StatusMethodNotAllowed)
		return
	}

	token := r.Context().Value("userToken").(*auth.Token)
	uid := token.UID

	var payload struct {
		ItemId string `json:"itemId"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	if payload.ItemId == "" {
		http.Error(w, "itemId is required", http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	// 1. Fetch the shared workout
	docSnap, err := firestoreClient.Collection("community_shared_workouts").Doc(payload.ItemId).Get(ctx)
	if err != nil {
		log.Printf("Error fetching shared workout for deletion: %v", err)
		http.Error(w, "Workout not found", http.StatusNotFound)
		return
	}

	data := docSnap.Data()

	// 2. Prevent deleting someone else's workout
	if data["authorId"] != uid {
		http.Error(w, "You can only delete your own workout", http.StatusForbidden)
		return
	}

	// 3. Delete the workout
	_, err = firestoreClient.Collection("community_shared_workouts").Doc(payload.ItemId).Delete(ctx)
	if err != nil {
		log.Printf("Error deleting shared workout: %v", err)
		http.Error(w, "Failed to delete workout", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Workout deleted successfully",
	})
}

func sendChatNotificationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Yalnız POST metoduna icazə verilir", http.StatusMethodNotAllowed)
		return
	}

	var payload struct {
		ReceiverId string `json:"receiverId"`
		SenderName string `json:"senderName"`
		Text       string `json:"text"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	ctx := context.Background()

	// 1. Alıcının (Receiver) fcmToken-ni user_about kolleksiyasından alırıq
	docSnap, err := firestoreClient.Collection("user_about").Doc(payload.ReceiverId).Get(ctx)
	if err != nil {
		log.Printf("Receiver user_about tapılmadı: %v", err)
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	data := docSnap.Data()
	fcmToken, ok := data["fcmToken"].(string)
	if !ok || fcmToken == "" {
		// FCM token yoxdursa notification göndərmirik
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "User has no FCM token. Notification skipped.",
		})
		return
	}

	// 2. Mesajı (Push Notification) hazırlayırıq
	message := &messaging.Message{
		Token: fcmToken,
		Notification: &messaging.Notification{
			Title: payload.SenderName,
			Body:  payload.Text,
		},
		Data: map[string]string{
			"type":       "chat_message",
			"senderName": payload.SenderName,
		},
	}

	// 3. Mesajı göndəririk
	response, err := messagingClient.Send(ctx, message)
	if err != nil {
		log.Printf("Xəta: Push notification göndərilmədi: %v", err)
		http.Error(w, "Failed to send notification", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Notification sent successfully",
		"response": response,
	})
}

func startMessageCleanupJob() {
	ticker := time.NewTicker(1 * time.Hour)
	go func() {
		// İlk dəfə həmən işləsin deyə
		runCleanup()
		for range ticker.C {
			runCleanup()
		}
	}()
}

func runCleanup() {
	log.Println("Running message cleanup job...")
	ctx := context.Background()
	
	// 24 saatdan əvvəlki vaxtı tapırıq
	cutoff := time.Now().Add(-24 * time.Hour)
	
	if firestoreClient == nil {
		log.Println("Error: firestoreClient is nil in cleanup job")
		return
	}

	// Bütün chat-ları alırıq
	chatIter := firestoreClient.Collection("chats").Documents(ctx)
	chats, err := chatIter.GetAll()
	if err != nil {
		log.Printf("Error fetching chats for cleanup (ProjectID might be missing?): %v", err)
		return
	}
	
	deletedCount := 0
	for _, chat := range chats {
		// Hər chat-ın içindəki messages alt-kolleksiyasına baxırıq
		msgIter := chat.Ref.Collection("messages").Where("createdAt", "<", cutoff).Documents(ctx)
		msgs, err := msgIter.GetAll()
		if err != nil {
			log.Printf("Error fetching messages for chat %s: %v", chat.Ref.ID, err)
			continue
		}
		
		for _, msg := range msgs {
			_, err := msg.Ref.Delete(ctx)
			if err == nil {
				deletedCount++
			}
		}
	}
	log.Printf("Message cleanup job finished. Deleted %d old messages.", deletedCount)
}

func main() {
	// 1. Firebase üçün context yaradırıq
	ctx := context.Background()

	// 2. Service Account faylımızı göstəririk
	opt := option.WithCredentialsFile("serviceAccountKey.json")

	// 3. Firebase Tətbiqini inisializasiya edirik
	config := &firebase.Config{ProjectID: "greenfit-b27e5"}
	app, err := firebase.NewApp(ctx, config, opt)
	if err != nil {
		log.Fatalf("Firebase inisializasiya xətası: %v\n", err)
	}

	// 4. Firebase Auth klientini yaradırıq (Token yoxlamaq üçün)
	firebaseAuth, err = app.Auth(ctx)
	if err != nil {
		log.Fatalf("Firebase Auth xətası: %v\n", err)
	}

	// 5. Firestore klientini yaradırıq (Məlumat bazası üçün)
	firestoreClient, err = app.Firestore(ctx)
	if err != nil {
		log.Fatalf("Firestore xətası: %v\n", err)
	}
	defer firestoreClient.Close()

	// 6. Messaging klientini yaradırıq (Bildirişlər/FCM üçün)
	messagingClient, err = app.Messaging(ctx)
	if err != nil {
		log.Fatalf("Messaging xətası: %v\n", err)
	}

	fmt.Println("Firebase (Auth, Firestore və Messaging) uğurla qoşuldu!")

	// Mesaj silinmə job-unu (arka planda) başladırıq
	startMessageCleanupJob()

	// Rotalar (Routes)
	// Açıq rota (Token tələb etmir)
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Fallback to root handler for path: %s", r.URL.Path)
		fmt.Fprintf(w, "GreenFit Go Backend işləyir! (Açıq səhifə) - Path: %s", r.URL.Path)
	})

	// Qorunan rota (Token TƏLƏB edir)
	http.HandleFunc("/api/data", authMiddleware(secureDataHandler))

	// YENİ: Proqram həftələrini gətirən rota
	http.HandleFunc("/api/program-weeks", authMiddleware(getProgramWeeksHandler))

	// YENİ: Məşq planını və detallarını gətirən rota
	http.HandleFunc("/api/workout-plan", authMiddleware(getWorkoutPlanHandler))

	// NEW: Create Custom Workout
	http.HandleFunc("/api/create-custom-workout", authMiddleware(createCustomWorkoutHandler))

	// COMMUNITY ROUTES
	http.HandleFunc("/api/community/share-program", authMiddleware(shareProgramToCommunityHandler))
	http.HandleFunc("/api/community/share-workout", authMiddleware(shareWorkoutToCommunityHandler))
	http.HandleFunc("/api/community/items", authMiddleware(getCommunityItemsHandler))
	http.HandleFunc("/api/community/download-program", authMiddleware(downloadCommunityProgramHandler))
	http.HandleFunc("/api/community/download-workout", authMiddleware(downloadCommunityWorkoutHandler))
	http.HandleFunc("/api/community/delete-program", authMiddleware(deleteCommunityProgramHandler))
	http.HandleFunc("/api/community/delete-workout", authMiddleware(deleteCommunityWorkoutHandler))

	// NOTIFICATION ROUTES
	http.HandleFunc("/api/notifications/chat", authMiddleware(sendChatNotificationHandler))

	fmt.Println("Server http://localhost:8080 ünvanında dinləyir...")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
