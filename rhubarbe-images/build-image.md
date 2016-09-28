# Purpose

`build-image.py` is a tool for automating the simple process of

* loading an image `from_image`
* run some scripts
* saving the image as `to_image`

The actual set of scripts and their logs are all preserved on the node in `/etc/rhubarbe-history`

# Warnings

* Tool is for local usage only
* should be run in the same directory where `build-image.sh` sits

# Synopsis

```
build-image.py gateway node from_image to_image scripts...
```

# Examples

## Use `-f/--fast` to avoid actually loading/saving image

For debugging script `foo.sh`

```
build-image.py -f root@faraday.inria.fr fit02 ubuntu ubuntu-prime foo.sh
```

## Run a script with an argument
```
build-image.py root@faraday.inria.fr fit02 ubuntu ubuntu-prime "./imaging.sh init-node-ssh-key"
```

## Run a few scripts

Here 3 scripts:

```
build-image.py root@faraday.inria.fr fit02 ubuntu ubuntu-prime foo.sh bar.sh "./imaging.sh init-node-ssh-key"
```

## Inspect results

On target node:

```
# cd /etc/rhubarbe-history/ubuntu-prime
# ls
args  logs  scripts
# ls -ls scripts
total 8
8 -rwx------. 1 502 games 5142 Sep 28  2016 001-imaging.sh
# ls -l logs
total 4
-rw-r--r--. 1 root root 178 Sep 28 00:02 001-imaging.sh.log
```
