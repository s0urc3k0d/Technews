FROM grafana/grafana:10.3.0

COPY ./monitoring/grafana/provisioning /etc/grafana/provisioning
COPY ./monitoring/grafana/dashboards /etc/grafana/dashboards