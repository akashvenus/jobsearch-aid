FROM python:3.14.2-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    redis-server \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

FROM base AS production

COPY . .

EXPOSE 8000

RUN echo '#!/bin/bash\nredis-server --daemonize yes\nuvicorn main:app --host 0.0.0.0 --port 8000' > /start.sh && chmod +x /start.sh

CMD ["/start.sh"]

FROM base AS development

COPY . .

EXPOSE 8000

RUN echo '#!/bin/bash\nredis-server --daemonize yes\nuvicorn main:app --host 0.0.0.0 --port 8000 --reload' > /start-dev.sh && chmod +x /start-dev.sh

CMD ["/start-dev.sh"]