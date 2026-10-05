# 🌾 AI-Enabled Smart Farming for Sustainable Agriculture

A full-stack smart-farming application for crop recommendation, fertilizer guidance, plant-disease detection, weather forecasts, multilingual UI, and an AI farming assistant.

## Architecture

```text
React + Vite frontend (5173)
        │
        │ REST / JSON + multipart image upload
        ▼
Node.js + Express backend (5000)
        │
        ├── OpenWeatherMap API
        ├── Gemini API (optional chatbot)
        ├── MongoDB (optional for the currently implemented routes)
        └── Flask ML service (5001)
                 ├── Crop recommendation model
                 ├── Fertilizer rule engine
                 └── Disease CNN (optional TensorFlow/Keras runtime)
```

## Features

- English, Hindi, and Marathi interface
- Crop recommendation using a Random Forest model
- Fertilizer recommendation using NPK + pH rules
- Plant disease image upload/camera flow
- 5-day weather forecast through OpenWeatherMap
- AI farming chatbot through Gemini
- Responsive React/Tailwind UI

## Requirements

- Node.js 18+ (Node.js 20/22 recommended)
- npm 9+
- Python 3.10–3.13
- Internet access for installing dependencies and for OpenWeather/Gemini features
- MongoDB only if database-backed functionality is added/enabled

> The included disease model is a Keras 3 `.h5` model. TensorFlow/Keras is intentionally optional in the base ML requirements because TensorFlow support varies by Python version and platform. Crop and fertilizer services do not require TensorFlow.

## 1. Backend setup

```bash
cd backend
npm install
```

Copy `backend/.env.example` to `backend/.env` and set the values you actually have:

```env
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/smart-farming
FLASK_ML_SERVICE_URL=http://localhost:5001
OPENWEATHER_API_KEY=your_openweather_api_key
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

Never commit `backend/.env` or real API keys.

Start the backend:

```bash
npm start
```

Health check:

```text
http://localhost:5000/api/health
```

## 2. Python ML service

Create and activate a virtual environment:

### Windows

```powershell
cd backend\ml_services
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### macOS/Linux

```bash
cd backend/ml_services
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Health check:

```text
http://localhost:5001/health
```

The health response reports whether the crop and disease models were actually loaded.

### Optional disease CNN

The bundled `ml_models/disease_detection/disease_model.h5` requires a TensorFlow/Keras runtime compatible with the Python version on your machine. If TensorFlow is installed and the model loads successfully, `/predict/disease` uses the CNN. Otherwise the service returns a clear `503` rather than pretending to diagnose an image.

## 3. Frontend setup

```bash
cd frontend
npm install
```

Copy `frontend/.env.example` to `frontend/.env` if you want to override the backend URL:

```env
VITE_API_URL=http://localhost:5000/api
```

Start the frontend:

```bash
npm run dev
```

Open the URL printed by Vite, normally:

```text
http://localhost:5173
```

## 4. Train/rebuild the crop model

The repository contains a small sample crop dataset. To rebuild the Random Forest model with the scikit-learn version installed in your environment:

```bash
cd ml_models
python train_all_models.py
```

The current included dataset has only 36 rows and 6 crop classes. It is suitable for project demonstration/testing, not for production-grade agricultural recommendations.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Backend health/database status |
| POST | `/api/crop/recommend` | Crop recommendation |
| POST | `/api/fertilizer/recommend` | Fertilizer recommendation |
| POST | `/api/disease/detect` | Leaf image disease detection |
| GET | `/api/weather/forecast?city=Pune` | Weather + forecast |
| POST | `/api/chat/ask` | AI farming assistant |

The frontend uses the same API base URL for all backend calls; no feature contains a separate hard-coded localhost API URL.

## Important limitations

- Weather requires a valid OpenWeather API key.
- Chatbot requires a valid Gemini API key.
- Disease CNN requires a compatible TensorFlow/Keras installation and a successfully loaded model.
- MongoDB is not required by the current ML/API flows; the backend reports its status and continues when it is unavailable.
- The included crop dataset is intentionally small and should not be treated as a production training set.

## Security notes

- Secrets belong in environment variables, never source files.
- The backend does not print API-key values.
- Uploaded disease images are stored temporarily and deleted after the ML request completes.
- Image uploads are limited to 5 MB and image MIME types.

## Project structure

```text
smart-farming-app/
├── backend/
│   ├── ml_services/app.py
│   ├── models/index.js
│   ├── routes/
│   ├── .env.example
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   ├── .env.example
│   └── package.json
├── datasets/
├── ml_models/
└── sample_images/
```
