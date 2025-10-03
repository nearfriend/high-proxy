#!/usr/bin/env bash

mkdir -p temp
echo "Updating Apt"
apt-get update
echo "Installing Apt files"
apt-get install mongodb -y

if [ $? -ne 0 ]
then
	echo -e "MongoDB could not be installed in auto mode, Install manually!......\n"
    echo -e "\tExiting!!!!!!!!!\n\n"
    echo -e "\tHALT"
	exit 1
fi

echo "Building and Configuring  Tor Proxy......."
apt remove tor -y

CODE_NAME=`lsb_release -c -s`
OS_ARCH=`dpkg --print-architecture`

echo "deb [arch=$OS_ARCH signed-by=/usr/share/keyrings/tor-archive-keyring.gpg] https://deb.torproject.org/torproject.org $CODE_NAME main" > /etc/apt/sources.list.d/tor.list
echo "deb-src [arch=$OS_ARCH signed-by=/usr/share/keyrings/tor-archive-keyring.gpg] https://deb.torproject.org/torproject.org $CODE_NAME main" >> /etc/apt/sources.list.d/tor.list

wget -qO- https://deb.torproject.org/torproject.org/A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89.asc | gpg --dearmor | tee /usr/share/keyrings/tor-archive-keyring.gpg >/dev/null

apt update
apt install tor deb.torproject.org-keyring -y

grep -E "^HTTPTunnelPort 8118$" /etc/tor/torrc || echo "HTTPTunnelPort 8118" >> /etc/tor/torrc

service tor restart

echo "Tor configuration and building Complete......"

apt install vim certbot php-cgi curl netcat unzip jq -y

echo "Install node v14"

curl -L https://raw.githubusercontent.com/tj/n/master/bin/n -o temp/n
bash temp/n 12

echo "Install & Start  Tor Service"
apt install tor -y

service tor start

echo "Starting DB service"

service mongodb start

echo "Installing Npm packages for main"
npm install

echo "Setting Up Daemon App Daemonize"
npm i -g pm2 forever


if [[ $(id -u) != 0 ]]; then
    echo "You must run this script as root or using sudo."
    exit 1
fi

echo "Setting Up Enviromental Files"

echo "Checking Hostname IP....."
hostIp=`hostname -I|xargs`
echo "Host ip is $hostIp"


echo "Generating Secret....."
newSecret=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)

siteAuth=$(for i in {1..6}; do echo -n "/$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 8 | head -n 1)"; done)

echo "Generating Defaults......."
export MANAGER_USERNAME="highProxy"
pm3Port=5111
hostPort=3000

echo "Finished Generating Defaults......"


echo "Settig up packages for highProxy"
cd highProxy
bash setup-highProxy.sh


echo "Finished installing highProxy packages"
cd -


if [ -e ".env" ]; then
  echo "ENV File Found Skipping the .env Setup"

else

cat > ".env" <<- EOM
HOST_IP=$hostIp

#MONGODB_URI=$MONGODB_URI

HOST_PORT=$hostPort

SITE_AUTH=$siteAuth

PM3_PORT=$pm3Port

EOM

fi

authKey=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)

echo -n $authKey > .auth

echo "ALL IS OK."
