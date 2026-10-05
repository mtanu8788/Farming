FROM python:3.10-slim

WORKDIR /app

COPY backend/ml_services/requirements.txt ./backend/ml_services/requirements.txt

RUN pip install --no-cache-dir -r backend/ml_services/requirements.txt

COPY backend/ml_services ./backend/ml_services

COPY ml_models ./ml_models

WORKDIR /app/backend/ml_services

EXPOSE 5001

CMD ["python", "app.py"]