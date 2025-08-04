#!/bin/bash

echo "🚀 Starting Firebase deployment..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found!"
    echo "Please create a .env file with your Firebase configuration variables."
    echo "You can use the firebase-env-template.txt as a reference."
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building the project..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully!"
    
    # Deploy to Firebase
    echo "🚀 Deploying to Firebase..."
    firebase deploy --only apphosting
    
    if [ $? -eq 0 ]; then
        echo "🎉 Deployment completed successfully!"
    else
        echo "❌ Deployment failed!"
        echo "Check the error messages above for more details."
    fi
else
    echo "❌ Build failed!"
    echo "Please fix the build errors before deploying."
fi 