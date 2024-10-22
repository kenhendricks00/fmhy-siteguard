#!/usr/bin/env bash

set -e

# Define build destination
DES=dist/build/FMHY-SafeGuard.chromium
rm -rf $DES
mkdir -p $DES

# Copy files specific to Chrome extension
cp -R platform/chromium/* $DES/

# Create a versioned ZIP package
pushd dist/build
zip -r FMHY-SafeGuard_"$1".chromium.zip FMHY-SafeGuard.chromium
popd
