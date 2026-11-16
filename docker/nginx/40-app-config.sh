#!/bin/sh
# יוצר את config.js של הקליינט מתוך משתנה הסביבה API_URL,
# כך שאותו image עובד בכל סביבה. API_URL היא הכתובת של ה-backend כפי שהדפדפן רואה אותה.
set -eu

API_URL="${API_URL:-http://localhost:3000}"

case "$API_URL" in
  http://*|https://*) ;;
  *) echo "40-app-config.sh: API_URL must start with http:// or https:// (got: $API_URL)" >&2; exit 1 ;;
esac
case "$API_URL" in
  *\'*|*\\*|*\"*|*'<'*|*'>'*) echo "40-app-config.sh: API_URL contains invalid characters" >&2; exit 1 ;;
esac

cat > /usr/share/nginx/html/config.js <<EOF
// נוצר אוטומטית בעליית הקונטיינר (docker/nginx/40-app-config.sh)
window.APP_CONFIG = {
  API_URL: '${API_URL}'
};
EOF

echo "40-app-config.sh: API_URL=${API_URL}"
