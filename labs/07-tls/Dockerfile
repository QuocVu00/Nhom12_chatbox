FROM python:3.12-slim
WORKDIR /app
COPY server.py /app/server.py
COPY cert /app/cert
EXPOSE 9443
CMD ["python","server.py"]
