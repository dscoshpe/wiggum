#!/bin/bash
# use wiggum to monitor signal strength of nearby BSSIDs

# make a named pipe for data transfer
rm signalmonitor
mkfifo signalmonitor

# start gnuplot signals chart (reads from signalmonitor)
gnuplot sigstrength.gnuplot &

# start the curl stats collector
while true; do
	# (writes to signalmonitor)
	curl -s http://localhost:8000/ap-list?top=30\&sortby=avghun\&show=name,hash,signal,avgten,avghun,count\&within=10 > signalmonitor
	sleep .5
	# watch -n 0.5 <curl cmd>
done

