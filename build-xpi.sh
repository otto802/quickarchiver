#!/bin/bash

VERSION=0.2.11

rm -f builds/quickarchiver-${VERSION}.xpi
cd src 
zip -x*/.DS_Store -r ../builds/quickarchiver-${VERSION}.xpi *
