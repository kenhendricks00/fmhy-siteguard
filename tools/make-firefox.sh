#!/usr/bin/env bash

set -e

# Define build destination
DES=dist/build/FMHY-SafeGuard.firefox
rm -rf $DES
mkdir -p $DES

# Copy files specific to Firefox extension
cp -R platform/firefox/* $DES/

# Create a versioned XPI package
pushd dist/build
zip -r FMHY-SafeGuard_"$1".firefox.xpi FMHY-SafeGuard.firefox
popd
