PACKAGE_ID = org.rpa.codexbar
VERSION = $(shell sed -n 's/.*"Version": "\([^"]*\)".*/\1/p' package/metadata.json)

.PHONY: install upgrade uninstall test run dist

# Build the KDE Store artifact: a zip of the package contents
# with metadata.json at the archive root.
dist:
	rm -f $(PACKAGE_ID)-v$(VERSION).plasmoid
	cd package && zip -r ../$(PACKAGE_ID)-v$(VERSION).plasmoid contents metadata.json -x '*~'
	@echo "Built $(PACKAGE_ID)-v$(VERSION).plasmoid"

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
