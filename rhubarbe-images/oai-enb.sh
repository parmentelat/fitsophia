#!/bin/bash
# configuration was about editing this file
# /root/openairinterface5g/targets/PROJECTS/GENERIC-LTE-EPC/CONF/enb.band7.tm1.usrpb210.epc.remote.conf
# in which we have
#
# * changed this line (was 92)
#     mobile_network_code =  "95";
#
# * changed this section to denote the remote (i.e. epc+hss) IP
#     mme_ip_address      = ( {ipv4 = "192.168.2.16";
#                              ipv6="192:168:30::17";
#                              active="yes";
#                              preference="ipv4";});
#
# changed the local IP address and interface name here
#
#     NETWORK_INTERFACES :
#    {
#        ENB_INTERFACE_NAME_FOR_S1_MME            = "data";
#        ENB_IPV4_ADDRESS_FOR_S1_MME              = "192.168.2.11/24";
#
#        ENB_INTERFACE_NAME_FOR_S1U               = "data";
#        ENB_IPV4_ADDRESS_FOR_S1U                 = "192.168.2.11/24";
#        ENB_PORT_FOR_S1U                         = 2152; # Spec 2152
#    };
#
# 
#
# then to run the node we did
### cd /root/openairinterface5g/cmake_targets/lte_build_oai/build
### ./lte-softmodem -O /root/openairinterface5g/targets/PROJECTS/GENERIC-LTE-EPC/CONF/enb.band7.tm1.usrpb210.epc.remote.conf
### 
### # need to align these 
### 
### epc:          {MCC="208" ; MNC="95";  TAC = "1"; },                                  # YOUR TAI CONFIG HERE
### 
### with
### 
### enb:    tracking_area_code  =  "1";
### 
###

# xxx duplicated - need to be put in some kind of library
####################
function check_hostname() {
    # when hostname is correctly e.g. fit16
    fitid=$(hostname)
    id=$(sed -e s,fit,, <<< $fitid)
    origin="from hostname"
    if [ "$fitid" == "$id" ]; then
	# sample output
	#inet 192.168.3.16/24 brd 192.168.3.255 scope global control
	id=$(ip addr show control | \
		    grep 'inet '| \
		    awk '{print $2;}' | \
		    cut -d/ -f1 | \
		    cut -d. -f4)
	fitid=fit$id
	origin="from ip addr show"
	echo "Forcing hostname to be $fitid"
	hostname $fitid
    fi
    echo "Using id=$id and fitid=$fitid - $origin"
}    

available_subcommands="$available_subcommands gitup"
function gitup() {
    here=$(pwd)
    echo "========== Pulling git repos"
    cd /root/openair-cn
    git pull

    cd /root/r2lab
    git pull
    cd $here
}
####################

available_subcommands=""

conf_dir=/root/openairinterface5g/targets/PROJECTS/GENERIC-LTE-EPC/CONF/
run_dir=/root/openairinterface5g/cmake_targets/lte_build_oai/build
template=enb.band7.tm1.usrpb210.epc.remote.conf
gw_id_file=/root/oai-gw.id

requires_chmod_x="/root/openairinterface5g/targets/RT/USER/init_b200.sh"

available_subcommands="$available_subcommands define-gw"
function define-gw() {
    echo "=== define-gw allows you to store the identity of the node being used as a gateway"
    echo "=== example: define-gw 16"
    echo "=== this is stored in file $gw_id_file"
    echo "=== it is required before you can use the configure subcommand"
    if [ -f $gw_id_file ]; then
	echo "Current setting is " $(cat $gw_id_file)
    else
	echo "No gateway defined yet"
    fi
    echo -n "Enter new gateway id (just a number) "
    read id
    echo $id > $gw_id_file
    echo "Node defined as the 5g gateway : " $(cat $gw_id_file)
}

available_subcommands="$available_subcommands configure"
function configure() {
    [ -f $gw_id_file ] || {
	echo "file $gw_id_file not found; you need to run $COMMAND define-gw first - exiting";
	exit 1;
    }
    gw_id=$(cat $gw_id_file)
    echo "Using gateway $gw_id"

    gitup
    check_hostname
    
    cd $conf_dir
    cat <<EOF > oai-enb.sed
s,mobile_network_code =.*,mobile_network_code = "95";,
s,192.168.12.170,192.168.2.$gw_id,
s,eth4,data,
s,192.168.12.242/24,192.168.2.$fitid/24,g
EOF
    echo in $(pwd)
    sed -f oai-enb.sed < $template > r2lab.conf
    echo "Overwrote r2lab.conf in $(pwd)"
    cd - >& /dev/null
}

available_subcommands="$available_subcommands start"
function start() {
    cd $run_dir
    echo "In $(pwd)"
    echo "Running run_epc in background"
    # --gdb is a possible additional option here
    ./run_epc --set-nw-interfaces --remove-gtpu-kmodule >& run_epc.log &
    echo "Running lte-softmodem in background"
    ./lte-softmodem -O $conf_dir/r2lab.conf >& lte-softmodem.log &
    cd - >& /dev/null
}

####################
function main() {
    if [[ -z "$@" ]]; then
	echo "========== Available subcommands $available_subcommands"
    fi
    for subcommand in "$@"; do
	echo "========== Running stage $subcommand"
	$subcommand
    done
}

########################################
main "$@"
