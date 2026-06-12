FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV STREAMLIT_SERVER_HEADLESS=true
ENV STREAMLIT_SERVER_ADDRESS=0.0.0.0
ENV STREAMLIT_SERVER_PORT=8501

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY src ./src
COPY app ./app
COPY config ./config

# Copy outputs if present; in production this will usually be a mounted volume.
COPY outputs ./outputs

RUN pip install --upgrade pip \
    && pip install -e . \
    && pip install streamlit plotly pandas openpyxl python-dotenv pyyaml requests supabase

EXPOSE 8501

