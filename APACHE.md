Load these modules in your `httpd.conf`

```
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
```

Add this somewhere before your `<Directory>` configuration

```
ProxyPass "/api" "http://localhost:5001"
ProxyPassReverse "/api" "http://localhost:5001"
```
