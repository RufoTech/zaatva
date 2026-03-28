package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"os"

	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"
)

type MuscleGroup struct {
	Name     string `json:"name" firestore:"name"`
	ImageURL string `json:"imageUrl" firestore:"imageUrl"`
}

type Exercise struct {
	Name         string        `json:"name" firestore:"name"`
	MainImage    string        `json:"mainImage" firestore:"mainImage"`
	VideoURL     string        `json:"videoUrl" firestore:"videoUrl"`
	Type         string        `json:"type" firestore:"type"`
	MuscleGroups []MuscleGroup `json:"muscleGroups" firestore:"muscleGroups"`
}

func main() {
	ctx := context.Background()

	opt := option.WithCredentialsFile("serviceAccountKey.json")
	config := &firebase.Config{ProjectID: "greenfit-b27e5"}
	app, err := firebase.NewApp(ctx, config, opt)
	if err != nil {
		log.Fatalf("error initializing app: %v", err)
	}

	client, err := app.Firestore(ctx)
	if err != nil {
		log.Fatalf("error getting Firestore client: %v", err)
	}
	defer client.Close()

	jsonFile, err := os.Open("back_exercises.json")
	if err != nil {
		log.Fatalf("error opening JSON file: %v", err)
	}
	defer jsonFile.Close()

	byteValue, _ := ioutil.ReadAll(jsonFile)

	var exercises []Exercise
	err = json.Unmarshal(byteValue, &exercises)
	if err != nil {
		log.Fatalf("error unmarshaling JSON: %v", err)
	}

	fmt.Printf("Read %d exercises from JSON.\n", len(exercises))

	collection := client.Collection("workouts")
	uploadedCount := 0
	skippedCount := 0

	for _, ex := range exercises {
		query := collection.Where("name", "==", ex.Name).Limit(1).Documents(ctx)
		docs, err := query.GetAll()
		if err != nil {
			log.Printf("Error checking exercise %s: %v", ex.Name, err)
			continue
		}

		if len(docs) > 0 {
			fmt.Printf("Exercise '%s' already exists. Skipping.\n", ex.Name)
			skippedCount++
			continue
		}

		if ex.Type == "" {
			ex.Type = "Back"
		}

		_, _, err = collection.Add(ctx, ex)
		if err != nil {
			log.Printf("Failed to add exercise %s: %v", ex.Name, err)
		} else {
			fmt.Printf("Successfully added exercise: %s\n", ex.Name)
			uploadedCount++
		}
	}

	fmt.Printf("\nSeeding finished!\nUploaded: %d\nSkipped (Duplicates): %d\n", uploadedCount, skippedCount)
}
