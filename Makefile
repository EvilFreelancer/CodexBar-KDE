PACKAGE_ID = org.rpa.codexbar

.PHONY: install upgrade uninstall test run

install:
	kpackagetool6 --type Plasma/Applet -i package

upgrade:
	kpackagetool6 --type Plasma/Applet -u package

uninstall:
	kpackagetool6 --type Plasma/Applet -r $(PACKAGE_ID)

test:
	node --test

run:
	plasmawindowed $(PACKAGE_ID)
