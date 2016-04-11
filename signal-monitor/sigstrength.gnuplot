clear
reset

################################################################################
set term qt 0 title 'Signal Strength'
#set term svg
#set output 'chart.svg'
set datafile separator "\t"
set macros

FILE='signalmonitor'
#FILE='samples.tsv'
NAME='1'
HASH='2'
SIGNAL='$3'
AVGTEN='$4'
AVGHUN='$5'
COUNT='6'
SECONDS='.5'

set xrange [-1:*]
set yrange [1:80]
set y2range [1:*]
set logscale y2
set xtics rotate by -35 scale 0 font ",8"
set ytics nomirror
set ylabel 'Signal Strength (|dBm|)'
set y2tics
set y2label 'Total Frames'
set style data histogram
set style histogram cluster gap 1
set style fill solid border -1

pause 3

# adapted from: https://github.com/aschn/gnuplot-colorbrewer/blob/master/qualitative/Set1.plt
# line styles
set linetype 1 lc rgb '#E41A1C' # red
set linetype 2 lc rgb '#377EB8' # blue
set linetype 3 lc rgb '#4DAF4A' # green
set linetype 4 lc rgb '#984EA3' # purple
set linetype 5 lc rgb '#FF7F00' # orange
set linetype 6 lc rgb '#FFFF33' # yellow
set linetype 7 lc rgb '#A65628' # brown
set linetype 8 lc rgb '#F781BF' # pink
set linetype cycle 8

plot FILE using (100+@SIGNAL):xtic(stringcolumn(@NAME)."\n".stringcolumn(@HASH)) title 'Last 1', \
	   '' using (100+@AVGTEN) title 'Last 10', \
	   '' using (100+@AVGHUN) title 'Last 100', \
	   '' using @COUNT title 'Count' axis x1y2

# repeat "forever" until gnuplot is killed
do for [t=1:999999] {
	replot
	pause @SECONDS
}

