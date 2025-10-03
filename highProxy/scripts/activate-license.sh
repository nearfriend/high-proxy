echo "Activating license for help Check Telegram: "

read -p "Enter License key: " license


cd nkp

./nkp.app activate $license $1
