#!/usr/bin/env python3

# for using print() in python3-style even in python2
from __future__ import print_function

# import nepi library and other required packages
from nepi.execution.ec import ExperimentController
from nepi.execution.resource import ResourceAction, ResourceState
from nepi.util.sshfuncs import logger

# creating an ExperimentController (EC) to manage the experiment
# the exp_id name should be unique for your experiment
# it will be used on the various resources
# to store results and similar functions
ec = ExperimentController(exp_id="A4-ping")

# we want to run a command right in the r2lab gateway
# so we need to define ssh-related details for doing so
gateway_hostname  = 'faraday.inria.fr'
gateway_key       = '~/.ssh/onelab.private'
# of course: you need to change this to describe your own slice
gateway_username  = 'onelab.inria.mario.tutorial'

# the names used for configuring the wireless network
wifi_interface = 'wlan0'
wifi_channel   = '4'
wifi_name      = 'my-net'
wifi_key       = '1234567890'

# this time we cannot use DHCP, so we provide all the details
# of the IP subnet manually
wifi_netmask   = '24'
wifi_ip_fit01  = '172.16.1.1'
wifi_ip_fit02  = '172.16.1.2'

fit01 = ec.register_resource("linux::Node",
                             username = 'root',
                             hostname = 'fit01',
                             gateway = gateway_hostname,
                             gatewayUser = gateway_username,
                             identity = gateway_key,
                             cleanExperiment = True,
                             cleanProcesses = True,
                             autoDeploy = True)

fit02 = ec.register_resource("linux::Node",
                             username = 'root',
                             hostname = 'fit02',
                             gateway = gateway_hostname,
                             gatewayUser = gateway_username,
                             identity = gateway_key,
                             cleanExperiment = True,
                             cleanProcesses = True,
                             autoDeploy = True)

# creating an application to
# configure an ad-hoc network on node fit01
cmd =  ""
cmd += "ip addr flush dev {}; ".format(wifi_interface)
cmd += "ip link set {} down; ".format(wifi_interface)
cmd += "iwconfig {} mode ad-hoc; ".format(wifi_interface)
cmd += "iwconfig {} channel {}; ".format(wifi_interface, wifi_channel)
cmd += "iwconfig {} essid '{}'; ".format(wifi_interface, wifi_name)
cmd += "iwconfig {} key {}; ".format(wifi_interface, wifi_key)
cmd += "ip link set {} up; ".format(wifi_interface)
cmd += "ip addr add {}/{} dev {}; ".format(wifi_ip_fit01, wifi_netmask, wifi_interface)
app_fit01 = ec.register_resource("linux::Application",
                                 command = cmd,
                                 autoDeploy = True,
                                 connectedTo = fit01)
ec.wait_finished(app_fit01)

# ditto on fit02
cmd = ""
cmd += "ip addr flush dev {}; ".format(wifi_interface)
cmd += "ip link set {} down; ".format(wifi_interface)
cmd += "iwconfig {} mode ad-hoc; ".format(wifi_interface)
cmd += "iwconfig {} channel {}; ".format(wifi_interface, wifi_channel)
cmd += "iwconfig {} essid '{}'; ".format(wifi_interface, wifi_name)
cmd += "iwconfig {} key {}; ".format(wifi_interface, wifi_key)
cmd += "ip link set {} up; ".format(wifi_interface)
cmd += "ip addr add {}/{} dev {}; ".format(wifi_ip_fit02, wifi_netmask, wifi_interface)
app_fit02 = ec.register_resource("linux::Application",
                                 command = cmd,
                                 autoDeploy = True,
                                 connectedTo = fit02)
ec.wait_finished(app_fit02)

# creating an application to ping the wireless
# interface of fit02 from fit01
cmd = 'ping -c5 -I {} {}'.format(wifi_interface, wifi_ip_fit02)
app1 = ec.register_resource("linux::Application",
                            command = cmd,
                            autoDeploy = True,
                            connectedTo = fit01)
ec.wait_finished(app1)

# and the other way around
cmd = 'ping -c5 -I {} {}'.format(wifi_interface, wifi_ip_fit01)
app2 = ec.register_resource("linux::Application",
                            command = cmd,
                            autoDeploy = True,
                            connectedTo = fit02)
ec.wait_finished(app2)

print ("--- INFO : experiment output on fit01:",
       ec.trace(app1, "stdout"))
print ("--- INFO : experiment output on fit02:",
       ec.trace(app2, "stdout"))

ec.shutdown()
