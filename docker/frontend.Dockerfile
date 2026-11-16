# Frontend: Nginx שמגיש את הקבצים הסטטיים של client/ (בלי build)
FROM nginx:1.28-alpine

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

# סקריפט שרץ בעליית הקונטיינר (ה-image הרשמי מריץ את כל /docker-entrypoint.d/*.sh)
# ויוצר את config.js לפי משתנה הסביבה API_URL.
# sed מסיר CR למקרה שהקובץ נשמר עם שורות Windows.
COPY docker/nginx/40-app-config.sh /docker-entrypoint.d/40-app-config.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-app-config.sh \
 && chmod 755 /docker-entrypoint.d/40-app-config.sh

COPY client/ /usr/share/nginx/html/

EXPOSE 80
