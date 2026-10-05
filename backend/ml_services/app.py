from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import pickle
import traceback

import numpy as np

try:
    from PIL import Image
except ImportError:
    Image = None

try:
    from tensorflow import keras
except ImportError:
    keras = None

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(BASE_DIR))
MODELS_DIR = os.path.join(PROJECT_ROOT, 'ml_models')

crop_model = None
disease_model = None

# Standard PlantVillage 38-class ordering used by the bundled CNN model.
DISEASE_CLASSES = [
    'Apple___Apple_scab', 'Apple___Black_rot', 'Apple___Cedar_apple_rust', 'Apple___healthy',
    'Blueberry___healthy', 'Cherry_(including_sour)___Powdery_mildew',
    'Cherry_(including_sour)___healthy', 'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot',
    'Corn_(maize)___Common_rust_', 'Corn_(maize)___Northern_Leaf_Blight', 'Corn_(maize)___healthy',
    'Grape___Black_rot', 'Grape___Esca_(Black_Measles)', 'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)',
    'Grape___healthy', 'Orange___Haunglongbing_(Citrus_greening)', 'Peach___Bacterial_spot',
    'Peach___healthy', 'Pepper,_bell___Bacterial_spot', 'Pepper,_bell___healthy',
    'Potato___Early_blight', 'Potato___Late_blight', 'Potato___healthy', 'Raspberry___healthy',
    'Soybean___healthy', 'Squash___Powdery_mildew', 'Strawberry___Leaf_scorch',
    'Strawberry___healthy', 'Tomato___Bacterial_spot', 'Tomato___Early_blight',
    'Tomato___Late_blight', 'Tomato___Leaf_Mold', 'Tomato___Septoria_leaf_spot',
    'Tomato___Spider_mites Two-spotted_spider_mite', 'Tomato___Target_Spot',
    'Tomato___Tomato_Yellow_Leaf_Curl_Virus', 'Tomato___Tomato_mosaic_virus', 'Tomato___healthy'
]


def load_models():
    global crop_model, disease_model

    crop_path = os.path.join(MODELS_DIR, 'crop_recommendation', 'crop_model.pkl')
    if os.path.exists(crop_path):
        try:
            with open(crop_path, 'rb') as model_file:
                crop_model = pickle.load(model_file)
            print('✅ Crop ML model loaded')
        except Exception as exc:
            crop_model = None
            print(f'❌ Crop model could not be loaded: {exc}')
    else:
        print('❌ Crop model not found')

    disease_path = os.path.join(MODELS_DIR, 'disease_detection', 'disease_model.h5')
    if not os.path.exists(disease_path):
        print('⚠️ Disease model not found')
        return

    if keras is None:
        print('⚠️ TensorFlow/Keras is not installed. Disease detection is unavailable until it is installed.')
        return

    try:
        disease_model = keras.models.load_model(disease_path, compile=False)
        print('✅ Disease model loaded')
    except Exception as exc:
        disease_model = None
        print(f'⚠️ Disease model could not be loaded: {exc}')


load_models()


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'running',
        'crop_model_loaded': crop_model is not None,
        'disease_model_loaded': disease_model is not None,
        'disease_detection_available': disease_model is not None and Image is not None,
    })


@app.route('/predict/crop', methods=['POST'])
def predict_crop():
    try:
        data = request.get_json(silent=True) or {}
        fields = ['nitrogen', 'phosphorus', 'potassium', 'temperature', 'humidity', 'ph', 'rainfall']
        missing = [field for field in fields if data.get(field) is None or data.get(field) == '']
        if missing:
            return jsonify({'error': 'Missing required fields', 'missing': missing}), 400

        if crop_model is None:
            return jsonify({'error': 'Crop model is not loaded'}), 503

        try:
            features = np.array([[float(data[field]) for field in fields]], dtype=float)
        except (TypeError, ValueError):
            return jsonify({'error': 'All crop inputs must be numeric'}), 400

        if not np.isfinite(features).all():
            return jsonify({'error': 'Crop inputs must be finite numbers'}), 400

        prediction = crop_model.predict(features)
        crop_name = str(prediction[0])

        probabilities = None
        if hasattr(crop_model, 'predict_proba'):
            probabilities = crop_model.predict_proba(features)[0]

        recommendations = []
        if probabilities is not None and hasattr(crop_model, 'classes_'):
            ranked = np.argsort(probabilities)[::-1][:3]
            for index in ranked:
                recommendations.append({
                    'crop_name': str(crop_model.classes_[index]),
                    'suitability_score': round(float(probabilities[index]) * 100, 2),
                    'notes': 'Score reflects this model’s relative confidence for the supplied conditions.'
                })

        if not recommendations:
            recommendations = [{
                'crop_name': crop_name,
                'suitability_score': None,
                'notes': 'The model returned a recommendation, but no probability score is available.'
            }]

        return jsonify({'success': True, 'recommendations': recommendations})
    except Exception as exc:
        traceback.print_exc()
        return jsonify({'error': 'Crop prediction failed', 'message': str(exc)}), 500


@app.route('/predict/disease', methods=['POST'])
def predict_disease():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image uploaded'}), 400

        if disease_model is None or Image is None:
            return jsonify({
                'error': 'Disease detection model is unavailable',
                'message': 'Install the compatible TensorFlow/Keras dependencies and restart the ML service.'
            }), 503

        image_file = request.files['image']
        if not image_file.filename:
            return jsonify({'error': 'Uploaded image has no filename'}), 400

        image = Image.open(image_file.stream).convert('RGB').resize((224, 224))
        array = np.asarray(image, dtype=np.float32) / 255.0
        prediction = disease_model.predict(np.expand_dims(array, axis=0), verbose=0)[0]
        class_index = int(np.argmax(prediction))
        confidence = float(prediction[class_index])
        disease_name = DISEASE_CLASSES[class_index] if class_index < len(DISEASE_CLASSES) else f'class_{class_index}'
        is_healthy = disease_name.lower().endswith('___healthy')

        return jsonify({
            'disease_name': disease_name.replace('___', ' - ').replace('_', ' '),
            'confidence': round(confidence, 4),
            'is_healthy': is_healthy,
            'cause': None if is_healthy else 'The model identified a plant-disease class. Confirm the diagnosis with a local agricultural expert before treatment.',
            'treatment': None if is_healthy else 'Remove severely affected leaves, avoid overhead watering, and use a crop-specific treatment only after confirming the disease.'
        })
    except Exception as exc:
        traceback.print_exc()
        return jsonify({'error': 'Disease prediction failed', 'message': str(exc)}), 500


@app.route('/predict/fertilizer', methods=['POST'])
def predict_fertilizer():
    try:
        data = request.get_json(silent=True) or {}
        required = ['nitrogen', 'phosphorus', 'potassium', 'ph', 'crop_type']
        missing = [field for field in required if data.get(field) is None or data.get(field) == '']
        if missing:
            return jsonify({'error': 'Missing required fields', 'missing': missing}), 400

        try:
            n = float(data['nitrogen'])
            p = float(data['phosphorus'])
            k = float(data['potassium'])
            ph = float(data['ph'])
        except (TypeError, ValueError):
            return jsonify({'error': 'NPK and pH values must be numeric'}), 400

        if not all(np.isfinite(value) for value in [n, p, k, ph]):
            return jsonify({'error': 'NPK and pH values must be finite numbers'}), 400

        if ph < 0 or ph > 14:
            return jsonify({'error': 'pH must be between 0 and 14'}), 400

        crop_type = str(data['crop_type']).strip()
        if not crop_type:
            return jsonify({'error': 'Crop type is required'}), 400

        if n < 30:
            fertilizer = 'Urea'
            reason = 'Nitrogen is the most limiting supplied nutrient.'
        elif p < 30:
            fertilizer = 'DAP'
            reason = 'Phosphorus is the most limiting supplied nutrient.'
        elif k < 30:
            fertilizer = 'MOP'
            reason = 'Potassium is the most limiting supplied nutrient.'
        else:
            fertilizer = 'Balanced NPK'
            reason = 'The supplied NPK values are not strongly deficient by the rule-based thresholds.'

        ph_note = 'Soil pH is in a generally suitable range.' if 5.5 <= ph <= 7.5 else 'Consider a soil-test-based pH correction before applying large fertilizer quantities.'

        return jsonify({
            'fertilizer_name': fertilizer,
            'quantity': '50 kg/acre (starting estimate; confirm with a soil test)',
            'application_method': 'Apply according to the product label and mix/incorporate as appropriate for the crop and fertilizer type.',
            'notes': f'{reason} {ph_note} Recommendation prepared for {crop_type}.'
        })
    except Exception as exc:
        traceback.print_exc()
        return jsonify({'error': 'Fertilizer recommendation failed', 'message': str(exc)}), 500


if __name__ == '__main__':
    print('🚀 ML service running on http://localhost:5001')
    app.run(host='0.0.0.0', port=int(os.getenv('FLASK_PORT', '5001')), debug=os.getenv('FLASK_DEBUG', 'false').lower() == 'true')
