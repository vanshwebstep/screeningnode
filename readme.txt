rm -rf api.screeningstar.co.in
git clone https://github.com/rohitwebstep/ScreeningStarNodeSequelize.git api.screeningstar.co.in
cd api.screeningstar.co.in
npm install
pm2 delete screeningstarnode
pm2 start src/index.js --name "screeningstarnode" -i max --max-memory-restart 800M --restart-delay 500
pm2 save
pm2 startup
pm2 list
pm2 logs screeningstarnode