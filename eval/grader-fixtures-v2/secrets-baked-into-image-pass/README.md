# Reports service

Generates and serves customer reports. One image is built and run in staging
and production.

Staging currently points at the production database because the connection
string is compiled into the image and nobody has separated them.
