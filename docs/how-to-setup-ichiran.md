## [Ichiran@home 2021: the ultimate guide](https://readevalprint.tumblr.com/post/639359547843215360/ichiranhome-2021-the-ultimate-guide)

Recently I’ve been contacted by several people who wanted to use my Japanese text segmenter [Ichiran](https://github.com/tshatrov/ichiran/) in their own projects. This is not surprising since it’s vastly superior to [Mecab](https://taku910.github.io/mecab/) and similar software, and is occassionally updated with new vocabulary unlike many other segmenters. Ichiran powers [ichi.moe](https://ichi.moe/) which is a very cool webapp that helped literally dozens of people learn Japanese.

A big obstacle towards the adoption of Ichiran is the fact that it’s written in Common Lisp and people who want to use it are often unfamiliar with this language. To fix this issue, I’m now providing a way to build Ichiran as a command line utility, which could then be called as a subprocess by scripts in other languages.

This is a master post how to get Ichiran installed and how to use it for people who don’t know any Common Lisp at all. I’m providing instructions for Linux (Ubuntu) and Windows, I haven’t tested whether it works on other operating systems but it probably should.

### PostgreSQL

Ichiran uses a PostgreSQL database as a source for its vocabulary and other things. On Linux install `postgresql` using your preferred package manager. On Windows use [the official installer](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads). You should remember the password for the `postgres` user, or create a new user if you know how to do it.

Download the [latest release](https://github.com/tshatrov/ichiran/releases) of Ichiran database. On the release page there are commands needed to restore the dump. On Windows they don’t really work, instead try to create database and restore the dump using pgAdmin (which is usually installed together with Postgres). Right-click on PostgreSQL/Databases/postgres and select “Query tool…”. Paste the following into Query editor and hit the Execute button.

```
CREATE DATABASE [database_name]
    WITH TEMPLATE = template0
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'Japanese_Japan.932'
    LC_CTYPE = 'Japanese_Japan.932'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

```

Then refresh the Databases folder and you should see your new database. Right-click on it then select “Restore”, then choose the file that you downloaded (it wants “.backup” extension by default so choose “Format: All files” if you can’t find the file).

You might get a bunch of errors when restoring the dump saying that “user ichiran doesn’t exist”. Just ignore them.

### SBCL

Ichiran uses [SBCL](http://sbcl.org/) to run its Common Lisp code. You can download Windows binaries for SBCL 2.0.0 from the official site, and on Linux you can use the package manager, or also use binaries from the [official site](http://sbcl.org/platform-table.html) although they might be incompatible with your operating system.

However you really want the latest version 2.1.0, especially on Windows for uh… [reasons](https://bugs.launchpad.net/sbcl/%2Bbug/1907970). There’s a [workaround](https://bugs.launchpad.net/sbcl/%2Bbug/1907970/comments/6) for Windows 10 though, so if you don’t mind turning on that option, you can stick with SBCL 2.0.0 really.

After installing _some_ version of SBCL (SBCL requires SBCL to compile itself), download the source code of the latest version and let’s get to business.

On Linux it should be easy, just run

```
sh make.sh --fancy
sudo sh install.sh

```

in the source directory.

On Windows it’s somewhat harder. Install [MSYS2](https://www.msys2.org/), then run “MSYS2 MinGW 64-bit”.

```
pacman -S mingw-w64-x86_64-toolchain make

# for paths in MSYS2 replace drive prefix C:/ by /c/ and so on

cd [path_to_sbcl_source]
export PATH="$PATH:[directory_where_sbcl.exe_is_currently]"

# check that you can run sbcl from command line now
# type (sb-ext:quit) to quit sbcl

sh make.sh --fancy

unset SBCL_HOME
INSTALL_ROOT=/c/sbcl sh install.sh

```

Then edit Windows environment variables so that `PATH` contains `c:\sbcl\bin` and `SBCL_HOME` is `c:\sbcl\lib\sbcl` (replace `c:\sbcl` here and in `INSTALL_ROOT` with another directory if applicable). Check that you can run a normal Windows shell (`cmd`) and run `sbcl` from it.

### Quicklisp

Quicklisp is a library manager for Common Lisp. You’ll need it to install the dependencies of Ichiran. Download `quicklisp.lisp` from the [official site](https://www.quicklisp.org/beta/) and run the following command:

```
sbcl --load /path/to/quicklisp.lisp

```

In SBCL shell execute the following commands:

```
(quicklisp-quickstart:install)
(ql:add-to-init-file)
(sb-ext:quit)

```

This will ensure quicklisp is loaded every time SBCL starts.

### Ichiran

Find the directory `~/quicklisp/local-projects` (`%USERPROFILE%\quicklisp\local-projects` on Windows) and `git clone` [Ichiran source code](https://github.com/tshatrov/ichiran/) into it. It is possible to place it into an arbitrary directory, but that requires [configuring ASDF](https://common-lisp.net/project/asdf/asdf.html#Configuring-ASDF), while `~/quicklisp/local-projects/` should work out of the box, as should `~/common-lisp/` but I’m not sure about Windows equivalent for this one.

Ichiran wouldn’t load without `settings.lisp` file which you might notice is absent from the repository. Instead, there’s a `settings.lisp.template` file. Copy `settings.lisp.template` to `settings.lisp` and edit the following values in `settings.lisp`:

- `*connection*` this is the main database connection. It is a list of at least 4 elements: _database name_, _database user_ (usually “postgres”), _database password_ and _database host_ (“localhost”). It can be followed by options like `:port 5434` if the database is running on a non-standard port.
- `*connections*` is an optional parameter, if you want to switch between several databases. You can probably ignore it.
- `*jmdict-data*` this should be a path to [these files](https://gitlab.com/yamagoya/jmdictdb/-/tree/master/jmdictdb/data) from JMdict project. They contain descriptions of parts of speech etc.
- ignore all the other parameters, they’re only needed for creating the database from scratch

Run `sbcl`. You should now be able to load Ichiran with

```
(ql:quickload :ichiran)

```

On the first run, run the following command. It should also be run after downloading a new database dump and updating Ichiran code, as it fixes various issues with the original JMdict data.

```
(ichiran/mnt:add-errata)

```

Run the test suite with

```
(ichiran/test:run-all-tests)

```

If not all tests pass, you did something wrong! If none of the tests pass, check that you configured the database connection correctly. If all tests pass, you have a working installation of Ichiran. Congratulations!

Some commands that can be used in Ichiran:

- `(ichiran:romanize "一覧は最高だぞ" :with-info t)` this is basically a text-only equivalent of [ichi.moe](https://ichi.moe/), everyone’s favorite webapp based on Ichiran.
- `(ichiran/dict:simple-segment "一覧は最高だぞ")` returns a list of `WORD-INFO` objects which contain a lot of [interesting data](https://github.com/tshatrov/ichiran/blob/master/dict.lisp#L1224) which is available through “accessor functions”. For example `(mapcar 'ichiran/dict:word-info-text (ichiran/dict:simple-segment "一覧は最高だぞ")` will return a list of separate words in a sentence.
- `(ichiran/dict:dict-segment "一覧は最高だぞ" :limit 5)` like `simple-segment` but returns top 5 segmentations.
- `(ichiran/dict:word-info-from-text "一覧")` gets a `WORD-INFO` object for a specific word.
- `ichiran/dict:word-info-str` converts a `WORD-INFO` object to a human-readable string.
- `ichiran/dict:word-info-gloss-json` converts a `WORD-INFO` object into a “json” “object” containing dictionary information about a word, which is not really JSON but an equivalent Lisp representation of it. But, it can be converted into a real JSON string with `jsown:to-json` function. Putting it all together, the following code will convert the word `一覧` into a JSON string:

```
(jsown:to-json
 (ichiran/dict:word-info-json
  (ichiran/dict:word-info-from-text "一覧")))

```

Now, if you’re not familiar with Common Lisp all this stuff might seem confusing. Which is where `ichiran-cli` comes in, a brand new Command Line Interface to Ichiran.

### ichiran-cli

`ichiran-cli` is just a simple command-line application that can be called by scripts just like `mecab` and its ilk. The main difference is that it must be built by the user, who has already did the previous steps of the Ichiran installation process. It needs to access the postgres database and the connection settings from `settings.lisp` are currently “baked in” during the build. It also contains a cache of some database references, so modifying the database (i.e. updating to a newer database dump) without also rebuilding `ichiran-cli` is highly inadvisable.

The build process is very easy. Just run `sbcl` and execute the following commands:

```
(ql:quickload :ichiran/cli)
(ichiran/cli:build)

```

sbcl should exit at this point, and you’ll have a new `ichiran-cli` (`ichiran-cli.exe` on Windows) executable in `ichiran` source directory. If sbcl didn’t exit, try deleting the old `ichiran-cli` and do it again, it seems that on Linux sbcl sometimes can’t overwrite this file for some reason.

Use `-h` option to show how to use this tool. There will be more options in the future but at the time of this post, it prints out the following:

```
>ichiran-cli -h
Command line interface for Ichiran

Usage: ichiran-cli [-h|--help] [-e|--eval] [-i|--with-info] [-f|--full] [input]

Available options:
  -h, --help      print this help text
  -e, --eval      evaluate arbitrary expression and print the result
  -i, --with-info print dictionary info
  -f, --full      full split info (as JSON)

By default calls ichiran:romanize, other options change this behavior

```

Here’s the example usage of these switches

- `ichiran-cli "一覧は最高だぞ"` just prints out the romanization
- `ichiran-cli -i "一覧は最高だぞ"` - equivalent of `ichiran:romanize :with-info t` above
- `ichiran-cli -f "一覧は最高だぞ"` - outputs the full result of segmentation as JSON. This is the one you’ll probably want to use in scripts etc.
- `ichiran-cli -e "(+ 1 2 3)"` - execute arbitrary Common Lisp code… yup that’s right. Since this is a new feature, I don’t know yet which commands people really want, so this option can be used to execute any command such as those listed in the previous section.

By the way, as I mentioned before, on Windows SBCL prior to 2.1.0 doesn’t parse non-ascii command line arguments correctly. Which is why I had to include a section about building a newer version of SBCL. However if you use Windows 10, there’s a workaround that avoids having to build SBCL 2.1.0. Open “Language Settings”, find a link to “Administrative language settings”, click on “Change system locale…”, and turn on “Beta: Use Unicode UTF-8 for worldwide language support”. Then reboot your computer. Voila, everything will work now. At least in regards to SBCL. I can’t guarantee that other command line apps which use locales will work after that.

That’s it for now, hope you enjoy playing around with Ichiran in this new year. よろしくおねがいします！

- [common lisp](https://readevalprint.tumblr.com/tagged/common%20lisp)
- [japanese](https://readevalprint.tumblr.com/tagged/japanese)
- [language](https://readevalprint.tumblr.com/tagged/language)
