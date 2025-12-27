# Content Summarization API

This is a Node.js Express API that accepts URLs or text and generates summaries using Google Gemini AI. Jobs are processed asynchronously in the background using BullMQ and Redis.

## Prerequisites

Make sure you have these installed on your system
- Node.js (v14 or higher)
- MongoDB (running locally or connection string)
- Redis (running locally, needed for job queue)

## Setup Steps

First clone or download this repository and navigate to the project folder

Install dependencies
```
npm install
```

Set up environment variables
Copy the .env.example file to .env
```
copy .env.example .env
```
Or on Linux/Mac
```
cp .env.example .env
```

Edit the .env file and add your Gemini API key
You can get a free API key from https://aistudio.google.com/app/apikey
Just replace `your_gemini_api_key_here` with your actual key

The default MongoDB URI is mongodb://localhost:27017/swiggy-task
If your MongoDB is running on a different host or port, update MONGODB_URI in the .env file

Redis defaults to localhost:6379
If your Redis is running elsewhere, update REDIS_HOST and REDIS_PORT in .env

## Running the Application

Start MongoDB and Redis if they are running locally
Make sure they are running before starting the app

Start the server
```
npm run dev
```

Or for production
```
npm start
```

The server will start on port 3000 by default
You should see messages like MongoDB connected successfully and Summary worker started

## API Endpoints

POST /submit
Submit a URL or text for summarization
Body can be:
```json
{
  "url": "https://example.com/article"
}
```
or
```json
{
  "text": "Long text content here..."
}
```
Returns a job_id immediately

GET /status/:jobId
Check the status of a job
Status can be pending, processing, completed, or failed

GET /result/:jobId
Get the summary result for a completed job
Only works for completed jobs

## Testing the API

Postman Collection
Import the Content_Summarization_API.postman_collection.json file into Postman
This includes all three endpoints with example requests
Just replace the jobId variable with actual job ID when checking status or getting results

Or use curl commands

Example curl to submit a job
```
curl -X POST http://localhost:3000/submit \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"https://example.com/article\"}"
```

Check status
```
curl http://localhost:3000/status/YOUR_JOB_ID
```

Get result
```
curl http://localhost:3000/result/YOUR_JOB_ID
```

## How It Works

When you submit a URL or text, the API checks if it was processed before using Redis cache
If found in cache, it returns immediately with the cached summary
If not found, it creates a job in MongoDB and adds it to a queue
A background worker picks up jobs from the queue one by one
The worker fetches the URL content if needed, calls Gemini AI to generate a summary
Results are saved to MongoDB and cached in Redis for 7 days
You can check the job status anytime and get the result when it completes

## Troubleshooting

If MongoDB connection fails
Check if MongoDB is running and the connection string in .env is correct

If Redis connection fails
Make sure Redis is running locally or update the connection details in .env

If jobs are not processing
Check the console logs for errors
The worker logs will show what is happening

If you see Gemini API errors
Verify your API key is correct in the .env file
Make sure you have not exceeded the free tier limits

## Project Structure

- controllers/ - Request handlers
- models/ - Database models
- services/ - Business logic services
- workers/ - Background job processors
- routes/ - API route definitions
- config/ - Configuration files
- utils/ - Utility functions

## Notes

The app uses BullMQ for job queue management which requires Redis
Jobs are processed asynchronously so responses are immediate
Caching is enabled so duplicate requests return instantly
All jobs are persisted in MongoDB so they survive server restarts

