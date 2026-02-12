FROM prom/prometheus:v2.50.0

COPY ./monitoring/prometheus/prometheus.yml /etc/prometheus/prometheus.yml
COPY ./monitoring/prometheus/alerts.yml /etc/prometheus/alerts.yml