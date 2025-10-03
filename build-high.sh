echo "Building highg...."
echo "Will build 2 Targets apiApp and executor"

echo "After building high Goto highProxy and run ./api.app"

cd highProxy


rm -f highProxy/highProxy.app
rm -f api.app

cd ../executor

echo "Building executor Binary"

yarn install --silent

rm -f high.app

yarn run build:high


cd ../apiApp

echo "Building executor Binary"

rm -f api.app

yarn install

yarn run build:api


cd ../highProxy

cp ../executor/highProxy.app highProxy/

cp ../apiApp/api.app .

cd ..

echo "now do this command cd highProxy; then run ./api.app"