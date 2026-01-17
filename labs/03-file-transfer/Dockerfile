FROM python:3.12-slim
WORKDIR /app
COPY server.py /app/server.py
RUN mkdir -p /app/uploads
EXPOSE 9003
CMD ["python","server.py"]
