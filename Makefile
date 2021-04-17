CLEANCSS = sh ./node_modules/.bin/cleancss -O2
UGLIFYJS = sh ./node_modules/.bin/uglifyjs -c -m
LESSC = sh ./node_modules/.bin/lessc
GZIP = gzip -9

# TODO: source-map?  Should generate gzip as well.

all: css/style.min.css css/logs.min.css css/compat.min.css js/common.min.js js/game.min.js js/games.min.js

css/style.min.css: css/style.css
	sh -c 'cat $^ | $(CLEANCSS) -o $@'

css/logs.min.css: css/logs.less
	sh -c 'cat $^ | $(LESSC) --include-path=css - | $(CLEANCSS) -o $@'

css/compat.min.css: css/compat.less
	sh -c 'cat $^ | $(LESSC) --include-path=css - | $(CLEANCSS) -o $@'

js/common.min.js: js/libs/bootstrap/bootstrap.min.js node_modules/tablesaw/dist/tablesaw.jquery.js node_modules/tablesaw/dist/tablesaw-init.js js/libs/dragscroll.js
	sh -c 'cat $^ | $(UGLIFYJS) -o $@'

js/game.min.js: js/game.js
	sh -c 'cat $^ | $(UGLIFYJS) -o $@'

js/games.min.js: js/games.js
	sh -c 'cat $^ | $(UGLIFYJS) -o $@'

.PHONY: all