#!/bin/bash

source $(dirname $BASH_SOURCE)/nodes.sh

doc-nodes-sep "#################### subcommands to the oai command (alias o)"

source $(dirname $BASH_SOURCE)/oai-common.sh

run_dir=/root/openairinterface5g/cmake_targets/lte_build_oai/build
lte_log="$run_dir/softmodem.log"
add-to-logs $lte_log
lte_pcap="$run_dir/softmodem.pcap"
add-to-datas $lte_pcap
conf_dir=/root/openairinterface5g/targets/PROJECTS/GENERIC-LTE-EPC/CONF/
#template=enb.band7.tm1.usrpb210.epc.remote.conf
template=enb.band7.tm1.usrpb210.conf
config=r2lab.conf
add-to-configs $conf_dir/$config

#requires_chmod_x="/root/openairinterface5g/targets/RT/USER/init_b200.sh"

doc-nodes dumpvars "list environment variables"
function dumpvars() {
    echo "oai_role=${oai_role}"
    echo "oai_ifname=${oai_ifname}"
    echo "oai_realm=${oai_realm}"
    echo "run_dir=$run_dir"
    echo "conf_dir=$conf_dir"
    echo "template=$template"
    echo "_configs=\"$(get-configs)\""
    echo "_logs=\"$(get-logs)\""
    echo "_datas=\"$(get-datas)\""
    echo "_locks=\"$(get-locks)\""
}

# would make sense to add more stuff in the base image - see the NEWS file
base_packages="git libboost-all-dev libusb-1.0-0-dev python-mako doxygen python-docutils cmake build-essential libffi-dev
texlive-base texlive-latex-base ghostscript gnuplot-x11 dh-apparmor graphviz gsfonts imagemagick-common 
 gdb ruby flex bison gfortran xterm mysql-common python-pip python-numpy qtcore4-l10n tcl tk xorg-sgml-doctools
"

####################
doc-nodes image "the entry point for nightly image builds"
function image() {
    dumpvars
    base
    deps
    build
}

####################
doc-nodes base "the script to install base software on top of a raw image" 
function base() {

    gitup

    # apt-get requirements
    apt-get update
    apt-get install -y $base_packages

    # 
    echo "========== Running git clone for openair-cn and r2lab and openinterface5g"
    cd
    echo -n | \
	openssl s_client -showcerts -connect gitlab.eurecom.fr:443 2>/dev/null | \
	sed -ne '/-BEGIN CERTIFICATE-/,/-END CERTIFICATE-/p' >> \
	    /etc/ssl/certs/ca-certificates.crt
    [ -d openair-cn ] || git clone https://gitlab.eurecom.fr/oai/openair-cn.git
    [ -d openairinterface5g ] || git clone https://gitlab.eurecom.fr/oai/openairinterface5g.git
    [ -d /root/r2lab ] || git clone https://github.com/parmentelat/r2lab.git

    echo "========== Setting up cpufrequtils"
    apt-get install -y cpufrequtils
    echo 'GOVERNOR="performance"' > /etc/default/cpufrequtils
    update-rc.d ondemand disable
    /etc/init.d/cpufrequtils restart
    # this seems to be purely informative ?
    cd
    cpufreq-info > cpufreq.info

}

doc-nodes deps "builds uhd for an oai image"
function deps() {

    gitup
    cd
    echo Building ETTUS - see $HOME/build-uhd-ettus.log
    build-uhd-ettus >& build-uhd-ettus.log

}

doc-nodes build-uhd-ettus "builds UHD from github.com/EttusResearch/uhd.git"
function build-uhd-ettus() {
    cd
    echo "========== Building UHD from ettus git repo"
    if [ -d uhd ]; then
	cd uhd; git pull
    else
	git clone git://github.com/EttusResearch/uhd.git
	cd uhd
    fi
    mkdir -p build
    cd build
    cmake ../host
    make
    make test
    make install
}

doc-nodes build-uhd-oai "build UHD using the OAI recipe" 
function build-uhd-oai() {
    gitup
    cd /root/openairinterface5g/cmake_targets
    run-in-log build-uhd-oai.log ./build_oai -w USRP -I
    # saved in oai-enb-oaiuhd 
}

doc-nodes build "builds oai5g for an oai image"
function build() {

    gitup

    cd
    echo Building OAI5G - see $HOME/build-oai5g.log
    build-oai5g >& build-oai5g.log

}

doc-nodes build-oai5g "builds oai5g - run with -x for building with software oscilloscope" 
function build-oai5g() {

    oscillo=""
    if [ -n "$1" ]; then
	case $1 in
	    -x) oscillo="-x" ;;
	    *) echo "usage: build-oai5g [-x]"; return 1 ;;
	esac
    fi

    OPENAIR_HOME=/root/openairinterface5g
    # don't do this twice
    grep -q OPENAIR ~/.bashrc >& /dev/null || cat >> $HOME/.bashrc <<EOF
export OPENAIR_HOME=$OPENAIR_HOME
export OPENAIR1_DIR=$OPENAIR_HOME/openair1
export OPENAIR2_DIR=$OPENAIR_HOME/openair2
export OPENAIR3_DIR=$OPENAIR_HOME/openair3
export OPENAIRCN_DIR=$OPENAIR_HOME/openair-cn
export OPENAIR_TARGETS=$OPENAIR_HOME/targets
alias oairoot='cd $OPENAIR_HOME'
alias oai0='cd $OPENAIR0_DIR'
alias oai1='cd $OPENAIR1_DIR'
alias oai2='cd $OPENAIR2_DIR'
alias oai3='cd $OPENAIR3_DIR'
alias oait='cd $OPENAIR_TARGETS'
alias oaiu='cd $OPENAIR2_DIR/UTIL'
alias oais='cd $OPENAIR_TARGETS/SIMU/USER'
alias oaiex='cd $OPENAIR_TARGETS/SIMU/EXAMPLES'
EOF

    source $HOME/.bashrc

    cd $HOME/openairinterface5g/cmake_targets/
    # xxx l'original avait une seule ligne :
    echo Building in $(pwd) - see 'build*log'
    run-in-log build-oai-1.log ./build_oai -I -w USRP
    run-in-log build-oai-2.log ./build_oai --eNB -c -w USRP
    [ -n "$oscillo" ] && run-in-log build-oai-3.log ./build_oai -x

    # initial instructions from T. Turletti mentioned this
    #cd $HOME/openairinterface5g/
    #sudo chmod +x ./targets/bin/init_nas_nos1
    #./targets/bin/init_nas_nos1
    # In fact I found this script instead
    #./cmake_targets/tools/init_nas_nos1
    # but since it was for a soft phone initially I skip it from the builds image
}

########################################
# end of image
########################################

doc-nodes configure "configure eNodeB (requires define-peer)"
function configure() {

    gw_id=$(get-peer)
    [ -z "$gw_id" ] && { echo "no peer defined"; return; }

    echo "Using gateway $gw_id"

    gitup
    id=$(r2lab-id)
    fitid=fit$id
    cd $conf_dir
    ### xxx TMP : we use eth1 instead of data
    # note that this requires changes in
    # /etc/network/interfaces as well
    # /etc/udev/rules.d/70..blabla as well
    # xxx on his printed stabyloed configs, Thierry T
    # had also changed this
    #s|eNB_name[ 	]*=.*|eNB_name = "softmodem_$fitid";|
    # but I suspect it actually causes this
    # r2lab.conf, mismatch between 1 active eNBs and 0 corresponding defined eNBs !
    cat <<EOF > oai-enb.sed
s|mobile_network_code[ 	]*=.*|mobile_network_code = "95";|
s|pucch_p0_Nominal[ 	]*=.*|pucch_p0_Nominal = -96;|
s|mme_ip_address[ 	]*=.*|mme_ip_address = ( { ipv4 = "192.168.${oai_subnet}.$gw_id";|
s|ENB_INTERFACE_NAME_FOR_S1_MME[ 	]*=.*|ENB_INTERFACE_NAME_FOR_S1_MME = "${oai_ifname}";|
s|ENB_INTERFACE_NAME_FOR_S1U[ 	]*=.*|ENB_INTERFACE_NAME_FOR_S1U = "${oai_ifname}";|
s|ENB_IPV4_ADDRESS_FOR_S1_MME[ 	]*=.*|ENB_IPV4_ADDRESS_FOR_S1_MME = "192.168.${oai_subnet}.$id/24";|
s|ENB_IPV4_ADDRESS_FOR_S1U[ 	]*=.*|ENB_IPV4_ADDRESS_FOR_S1U = "192.168.${oai_subnet}.$id/24";|
EOF
# s,tx_gain.*,tx_gain = 80;,
# s,rx_gain.*,rx_gain = 80;,
    echo in $(pwd)
    sed -f oai-enb.sed < $template > $config
    echo "Overwrote $config in $(pwd)"
    cd - >& /dev/null
}

doc-nodes init "initializes clock after NTP"
function init() {
    # clock
    init-clock
    # data interface if relevant
    [ "$oai_ifname" == data ] && echo Checking interface is up : $(data-up)
    echo "========== turning off offload negociations on ${oai_ifname}"
    offload-off ${oai_ifname}
#    echo "========== setting mtu to 1536 on interface ${oai_ifname}"
#    ip link set dev ${oai_ifname} mtu 1536
}

doc-nodes start "starts lte-softmodem - run with -d to turn on soft oscilloscope" 
function start() {

    oscillo=""
    if [ -n "$1" ]; then
	case $1 in
	    -d) oscillo="-d" ;;
	    *) echo "usage: start [-d]"; return 1 ;;
	esac
    fi

cd $run_dir
#    echo "In $(pwd)"
    echo "Running lte-softmodem in background"
    ./lte-softmodem -P softmodem.pcap --ulsch-max-errors 100 -O $conf_dir/$config $oscillo >& $lte_log &
    cd - >& /dev/null
}

doc-nodes status "displays the status of the softmodem-related processes"
doc-nodes stop "stops the softmodem-related processes"

function -list-processes() {
    pids="$(pgrep lte-softmodem)"
    echo $pids
}

doc-nodes ureset "Reset the URSP attached to this node"
function ureset() {
    id=$(r2lab-id)
    # WARNING this might not work on a node that
    # is not in its nominal location, like node 42 that
    # sits in slot 4
    cmc="192.168.1.$id"
    echo "Turning off USRP # $id"
    curl http://$cmc/usrpoff
    sleep 1
    echo "Turning on USRP # $id"
    curl http://$cmc/usrpon
}

doc-nodes scramble "shortcuts for scrambling the r2lab demo; use -blast to use max. gain"
function scramble() {
    mode=$1; shift
    command="uhd_siggen --freq=2.53G --gaussian --amplitude=0.9"
    case "$mode" in
	"")        command="$command -g 73" ; message="perturbating" ;;
	"-blast")  command="$command -g 90" ; message="blasting" ;;
	*)         echo unknown option "$mode"; return ;;
    esac
    echo "Running $command in foreground - press Enter at the prompt to exit"
    $command
}

########################################
define-main "$0" "$BASH_SOURCE"
main "$@"
