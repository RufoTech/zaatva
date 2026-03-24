package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"golang.org/x/oauth2/google"
)

func main() {
	os.Setenv("GOOGLE_APPLICATION_CREDENTIALS", "c:/Users/ASUS/Desktop/GreenFitFireBase-main-main-main/backend/serviceAccountKey.json")
	ctx := context.Background()
	creds, err := google.FindDefaultCredentials(ctx, "https://www.googleapis.com/auth/cloud-platform")
	if err != nil {
		log.Fatalf("FindDefaultCredentials error: %v", err)
	}
	fmt.Println("Found credentials.")
	
	tok, err := creds.TokenSource.Token()
	if err != nil {
		log.Fatalf("Token generation error: %v", err)
	}
	fmt.Printf("Successfully generated token! Expires: %s\n", tok.Expiry)
}
