# Download

The most recent version of SBCL is 2.5.6, released June 29, 2025. [Release notes](news.html#2.5.6).

**Source:** [sbcl-2.5.6-source.tar.bz2](http://prdownloads.sourceforge.net/sbcl/sbcl-2.5.6-source.tar.bz2?download)

The development version is available from git:

```
git clone [git://git.code.sf.net/p/sbcl/sbcl](http://sourceforge.net/p/sbcl/sbcl/ci/master/tree/)
```

**Binaries:**

After downloading SBCL, refer to the [Getting Started] section for instructions on how to install the release.

# Getting Started

SBCL is available in source and binary form for [a number of different architectures](platform-table.html). This page describes how to get SBCL installed and how to start
using it. For more complete installation instructions, please see the [INSTALL](http://sbcl.git.sourceforge.net/git/gitweb.cgi?p=sbcl/sbcl.git;a=blob_plain;f=INSTALL;hb=HEAD) document that comes with SBCL.

## Installing a binary

SBCL is available in binary form for many architectures. To
obtain the latest binary release for your system, visit the [platform support](platform-table.html) page and click on the green square which indicates your
platform. When the binary is downloaded, unpack the tarball:

```
bzip2 -cd sbcl-2.5.6-x86-linux-binary.tar.bz2 | tar xvf -
```

replacing `sbcl-2.5.6-x86-linux-binary.tar.bz2` with the name of the tarball you downloaded. Then enter the
directory which was unpacked, and run the installation script to
install SBCL in your `/usr/local` directory:

```
cd sbcl-2.5.6-x86-linux
sh install.sh
```

## Running SBCL

Make sure that `/usr/local/bin` is in your `PATH`. Then run SBCL by invoking "sbcl", which should
produce a banner like this:

```
This is SBCL 2.5.6, an implementation of ANSI Common Lisp.
More information about SBCL is available at <http://www.sbcl.org/>.

SBCL is free software, provided as is, with absolutely no warranty.
It is mostly in the public domain; some portions are provided under
BSD-style licenses.  See the CREDITS and COPYING files in the
distribution for more information.
*
```

To quit SBCL, type `(quit)`.

## Installing to a different prefix

You can install SBCL to a different directory prefix by setting
the `INSTALL_ROOT` environment variable before running
the installation script:

```
INSTALL_ROOT=/my/sbcl/prefix sh install.sh
```

To start SBCL, you need to set the SBCL_HOME environment
variable to point at a subdirectory of the place you installed SBCL:

```
export SBCL_HOME=/my/sbcl/prefix/lib/sbcl # for bash / zsh
setenv SBCL_HOME /my/sbcl/prefix/lib/sbcl # for csh / tcsh
```

Make sure that `/my/sbcl/prefix/bin` is in your `PATH` and invoke SBCL as described above.
