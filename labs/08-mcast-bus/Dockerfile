FROM python:3.12-slim
WORKDIR /app
COPY server.py /app/server.py
EXPOSE 9011
EXPOSE 9010/udp
EXPOSE 9012/udp
CMD ["python","server.py"]
