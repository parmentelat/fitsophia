#!/usr/bin/env python3

import os.path

from asynciojobs import Engine, Job, Sequence

from apssh import SshNode, SshJob, SshJobScript, SshJobCollector
from apssh.formatters import ColonFormatter

def r2lab_hostname(x):
    """
    Return a valid hostname from a name like either
    1 (int), 1(str), 01, fit1 or fit01 ...
    """
    return "fit{:02d}".format(int(str(x).replace('fit','')))

def script(s):
    """
    all the scripts are located in the same place
    """
    return os.path.join(os.path.expanduser("~/git/r2lab/infra/user-env/"), s)


# include the same set of utility scripts
includes = [ script(x) for x in [
    "r2labutils.sh", "nodes.sh", "oai-common.sh",
] ]

def run(slice, hss, epc, enb, scr, do_load, verbose, debug):
    """
    expects e.g.
    * slice : s.t like onelab.inria.oai.oai_build@faraday.inria.fr
    * hss : 23
    * epc : 16
    * enb : 19
    """

    # what the argparse knows as a slice actually is a gateway (user + host)
    gwuser, gwhost = slice.split('@')
    gwnode = SshNode(hostname = gwhost, username = gwuser,
                     formatter = ColonFormatter(verbose=verbose), debug=debug)

    hostnames = hssname, epcname, enbname, scrname = [ r2lab_hostname(x) for x in (hss, epc, enb, scr) ]
    
    hssnode, epcnode, enbnode, scrnode = [
        SshNode(gateway = gwnode, hostname = hostname, username = 'root',
                formatter = ColonFormatter(verbose=verbose), debug=debug)
        for hostname in hostnames
    ]

    load_infra = SshJob(
        node = gwnode,
        commands = [
            [ "rhubarbe", "load", "-i", "u16-oai-gw", hssname, epcname ],
            [ "rhubarbe", "wait", "-t",  120, hssname, epcname ],
        ],
        label = "load and wait HSS and EPC nodes",
    )

    load_enb = SshJob(
        node = gwnode,
        commands = [
            [ "rhubarbe", "load", "-i", "u16-oai-enb", enbname, scrname ],
            [ "rhubarbe", "wait", "-t", 120, enbname, scrname ],
        ],
        label = "load and wait ENB and SCR",
    )

    loaded = [load_infra, load_enb]

# actually run this in the gateway, not on the mac
# the ssh keys are stored in the gateway and I haven't yet figured how to leverage such remote keys
#    macphone = SshNode(gateway = gwnode, hostname = 'macphone', username = 'tester',
#                       formatter = ColonFormatter(verbose=verbose), debug = debug)
    stop_phone = SshJobScript(
        node = gwnode,
        command = [ script("faraday.sh"), "macphone", "r2lab/infra/user-env/macphone.sh", "phone-off" ],
        includes = includes,
        label = "Stopping phone",
        # stop it at the beginning of the scenario, so no required
    )

    run_hss = SshJobScript(
        node = hssnode,
        command = [ script("oai-gw.sh"), "run-hss", epc ],
        includes = includes,
        label = "run HSS",
        required = (loaded, stop_phone),
    )

    run_epc = SshJobScript(
        node = epcnode,
        command = [ script("oai-gw.sh"), "run-epc", hss ],
        includes = includes,
        label = "run EPC",
        required = (loaded, stop_phone),
    )

    run_enb = SshJobScript(
        node = enbnode,
        # run-enb expects the id of the epc as a parameter
        command = [ script("oai-enb.sh"), "run-enb", epc ],
        includes = includes,
        label = "run softmodem on ENB",
        required = (loaded, stop_phone),
    )

    # schedule the load phases only if required
    e = Engine(stop_phone, run_enb, run_epc, run_hss, verbose=verbose, debug=debug)
    if do_load:
        e.update(loaded)
    # remove requirements to the load phase if not added
    e.sanitize(verbose=False)
    
    print(40*'*', 'do_load=', do_load)
    if verbose:
        e.list()
    if not e.orchestrate():
        print("KO")
        e.debrief()
    else:
        print("OK")

# nothing to collect on the scrambler
def collect(run_name, slice, hss, epc, enb, scr, do_load, verbose, debug):

    gwuser, gwhost = slice.split('@')
    gwnode = SshNode(hostname = gwhost, username = gwuser,
                     formatter = ColonFormatter(verbose=verbose), debug=debug)

    functions = "hss", "epc", "enb"

    hostnames = hssname, epcname, enbname = [ r2lab_hostname(x) for x in (hss, epc, enb) ]
    
    nodes = hssnode, epcnode, enbnode = [
        SshNode(gateway = gwnode, hostname = hostname, username = 'root',
                formatter = ColonFormatter(verbose=verbose), debug=debug)
        for hostname in hostnames
    ]

    # first run a 'capture' function remotely to gather all the relevant
    # info into a single tar named <run_name>.tgz

    capturers = [
        SshJobScript(
            node = node,
            command = [ script("oai-common.sh"), "capture-{}".format(function), run_name ],
            label = "capturer on {}".format(function),
            # capture-enb will run oai-as-enb and thus requires oai-enb.sh
            includes = [script("oai-{}.sh".format(function))],
        )
        for (node, function) in zip(nodes, functions) ]
        
    collectors = [
        SshJobCollector(
            node = node,
            remotepaths = [ "{}-{}.tgz".format(run_name, function) ],
            localpath = ".",
            label = "collector on {}".format(function),
            required = capturer,
        )
        for (node, function, capturer) in zip(nodes, functions, capturers) ]

    e = Engine(verbose=verbose, debug=debug)
    e.update(capturers)
    e.update(collectors)
    
    if verbose:
        e.list()

    if not e.orchestrate():
        print("KO")
        e.debrief()
    else:
        print("OK")
        
def main():

    default_slice = "onelab.inria.oai.oai_build@faraday.inria.fr"
    def_hss, def_epc, def_enb, def_scr = 23, 16, 19, 11
    

    from argparse import ArgumentParser
    parser = ArgumentParser()
    parser.add_argument("-l", "--load", dest='do_load', action='store_true', default=False,
                        help='load images as well')
    parser.add_argument("-v", "--verbose", action='store_true', default=False)
    parser.add_argument("-d", "--debug", action='store_true', default=False)
    parser.add_argument("-s", "--slice", default=default_slice,
                        help="defaults to {}".format(default_slice))

    parser.add_argument("--hss", default=def_hss, help="defaults to {}".format(def_hss))
    parser.add_argument("--epc", default=def_epc, help="defaults to {}".format(def_epc))
    parser.add_argument("--enb", default=def_enb, help="defaults to {}".format(def_enb))
    parser.add_argument("--scr", default=def_scr, help="defaults to {}".format(def_scr))

    args = parser.parse_args()

    # build a dictionary with all the values in the args
    kwds = args.__dict__.copy()

    # actually run it
    run(**kwds)

    # then prompt for when we're ready to collect
    try:
        run_name = input("type capture name when ready : ")
        collect(run_name, **kwds)
    except Exception as e:
        print(e)
    

    
main()
