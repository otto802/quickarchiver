#!/bin/bash

VERSION=2.5.0

rm -f builds/quickarchiver-${VERSION}.xpi
cd src 
zip -x*/.DS_Store -r ../builds/quickarchiver-${VERSION}.xpi *
