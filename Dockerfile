# Backend: Express API (index.js)
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# קודם רק קבצי החבילות - כך שכבת ה-npm ci נשמרת ב-cache כל עוד התלויות לא השתנו
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# רק קוד השרת (בלי client, tests, .env - ראו .dockerignore).
# הקבצים שייכים ל-root ולכן המשתמש node יכול לקרוא אותם אבל לא לשנות אותם.
COPY index.js app.js config.js ./
COPY Controllers ./Controllers
COPY Middleware ./Middleware
COPY Models ./Models
COPY Routes ./Routes

USER node
EXPOSE 3000

# node ישירות (לא npm start) כדי ש-SIGTERM יגיע לתהליך ויתבצע כיבוי מסודר
CMD ["node", "index.js"]
