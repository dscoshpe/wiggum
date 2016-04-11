#!/bin/bash

node server.js

# should put interfaces in to monior mode:
# sudo iwconfig wlan1 mode monitor up

# need to allow lua scripts if running as root
sudo tshark -q -n -i wlan1 -X lua_script:tap.lua | nc localhost 9000
