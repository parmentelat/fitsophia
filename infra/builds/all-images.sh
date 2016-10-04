#/bin/bash

case $(hostname) in
    faraday*)
	gateway=localhost
	gitroot=/root/r2lab
	;;
    *)
	gateway=root@faraday.inria.fr
	gitroot=$HOME/git/r2lab
	;;
esac

###
build=$gitroot/rhubarbe-images/build-image.py

# we don't need all these includes everywhere but it makes it easier
function bim () {
    command="$build $gateway -p $gitroot/infra/user-env -i oai-common.sh -i nodes.sh -i r2labutils.sh"
    echo $command "$@"
    $command --silent "$@"
}

# run with an arg to get the command to run manually
[[ -n "$@" ]] && { bim --help; exit; }

####################
# one-shot : how we initialized the -v5-ntp images in the first place
# augment ubuntu-16.04 with ntp
#0# bim fit01 ubuntu-16.04-v4-node-env ubuntu-16.04-v5-ntp \
#0#   "imaging.sh ubuntu-setup-ntp" \
#0#   "nodes.sh gitup"

#0#  bim 6 ubuntu-14.04-v3-stamped ubuntu-14.04-v5-ntp \
#0#    "imaging.sh ubuntu-setup-ntp" \
#0#     "imaging.sh common-setup-node-ssh-key" \
#0#     "imaging.sh common-setup-user-env" \
#0#     "nodes.sh gitup"


bim 1 ubuntu-16.04-v5-ntp == "imaging.sh common-setup-user-env"
bim 2 ubuntu-16.04-v5-ntp u16-lowlat47 "imaging.sh ubuntu-k47-lowlatency"
bim 23 u16-lowlat47 u16-oai-gw "oai-gw.sh image"
# skip 4 that is crap all right
bim 19 u16-lowlat47 u16-oai-enb "oai-enb.sh image" -l /root/build-uhd-ettus.log -l /root/build-oai5g.log 

exit

# on the u14 front, the lowlatency kernel image built this way won't reboot
bim 6 ubuntu-14.04-v5-ntp == "imaging.sh common-setup-user-env"
bim 7 ubuntu-14.04-v5-ntp u14-lowlat47 "imaging.sh ubuntu-k47-lowlatency"
bim 8 u14-lowlat47 u14-oai-gw "oai-gw.sh image"
bim 9 u14-lowlat47 u14-oai-enb "oai-enb.sh image" -l /root/build-uhd-ettus.log -l /root/build-oai5g.log

### running apt-upgrade-all in unattended mode currently won't work
# and requires more work
# try to run apt-upgrade-all on ubuntu-16
# bim fit06 ubuntu-16.04 u16-upgrade "nodes.sh apt-upgrade-all"


####################
# same on ubuntu-14.04 + node-env
#0#bim fit02 ubuntu-14.04-v3-stamped ubuntu-14.04-v4-ntp-node-env \
#0#  "imaging.sh ubuntu-setup-ntp" \
#0#  "imaging.sh common-setup-user-env" \
#0#  "imaging.sh common-setup-node-ssh-key" \
#0#  "nodes.sh gitup"

#bim 36 ubuntu-14.04-v4-ntp-node-env == "nodes.sh common-setup-user-env"

# same on fedora-23
#0#bim fit03 fedora-23-node-env fedora-23-v4-ntp \
#0#  "imaging.sh fedora-setup-ntp" \
#0#  "nodes.sh gitup"

#bim 37 fedora-23-v4-ntp == "nodes.sh common-setup-user-env"


