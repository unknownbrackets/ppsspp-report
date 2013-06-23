CLEANCSS = node ./node_modules/.bin/cleancss -e
UGLIFYJS = sh ./node_modules/.bin/uglifyjs -c -m
GZIP = gzip -9

# TODO: source-map?  Should generate gzip as well.

all: css/style.min.css js/common.min.js

css/style.min.css: css/style.css
	sh -c 'cat $^ | $(CLEANCSS) -o $@'

js/common.min.js: js/libs/bootstrap/bootstrap.min.js
	sh -c 'cat $^ | $(UGLIFYJS) -o $@'

.PHONY: all