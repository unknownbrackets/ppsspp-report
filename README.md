# PPSSPP Reporting Server

This is a simple server that receives reports from PPSSPP, and stores them.

You can clone this and point your copy of PPSSPP to it using the ReportHost ini setting.


## Environment Variables

Originally this was based on an OpenShift template.  You can use the following variables:
 * OPENSHIFT_MYSQL_DB_HOST
 * OPENSHIFT_MYSQL_DB_PORT
 * OPENSHIFT_MYSQL_DB_USERNAME
 * OPENSHIFT_MYSQL_DB_PASSWORD

This may change.


## PPSSPP

http://www.ppsspp.org/