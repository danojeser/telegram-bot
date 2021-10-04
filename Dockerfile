FROM python:3.8.12-slim

WORKDIR /usr/src/app

COPY requirements.txt ./
COPY .env ./
COPY . .
RUN pip install --no-cache-dir -r requirements.txt

CMD [ "python", "./src/main.py" ]
