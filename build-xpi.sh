#!/bin/bash

VERSION=2.1.1

rm -f builds/quickarchiver-${VERSION}.xpi
cd src 
zip -x*/.DS_Store -r ../builds/quickarchiver-${VERSION}.xpi *
