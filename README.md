# mgsp
MGSP is a proxy application that routes Minecraft SLP protocol data to remote servers. It can intercept traffic, manipulate it and return it to the game client.

# About mgsp
You can create an instance of MGSP to route multiple Minecraft servers either through local networks or remote networks.\
For example you can have a local network with 7 different Minecraft servers running from Port 25565-25572 on different machines, in a separate docker host you have an instance running of MGSP, which points to all hosts and listens to 25565.\
You forward MGSP to the internet, and create 7 subdomains on a domain online.

Now you can run 7 different Minecraft servers through the same port.

Another use case of MGSP is to hide the real IP of a server, additionally you can also configure firewall rules, so only MGSP can connect.

MGSP works on domain-level.

# Building the image
Just like any image, build it using the `docker build` command inside the source code folder:
```
git clone https://github.com/mgsp-node/mgsp --branch release --single-branch
cd mgsp
sudo docker build -t mgsp:latest .
```

# Running the image
You can run this image on any port, but the suggested overall port is 25565, if you don't specify one via `-e`, then it will default to 25565.
However, you still need to use -p to map the container port to your host.

We will also create a folder on your host where the config files reside, so you can edit them easier.\
Besides that we get the ability to update our image easier.

Be aware if you update the image, create a backup of your config files.\
If you encounter any errors after an upgrade, the files you're using could be out-of-date and need manual migration.

If you don't specify a volume, then the files will reside in the container, replacing the image will cause the config files to be lost then.

## Example run commands
The following commands are just examples and can be customized.\
Be aware after customization, the commands in this README may vary.

### Standard run command
```shell
sudo mkdir -p /opt/mgsp/config
sudo docker run -dit --name MGSP -p 25565:25565 -v /opt/mgsp/config:/app/config mgsp:latest
```

### Running on a different port
```shell
sudo mkdir -p /opt/mgsp/config
sudo docker run -dit --name MGSP -p 25050:25050 -e PORT=25050 -v /opt/mgsp/config:/app/config mgsp:latest
```

## Further configurations
The following things are additional but may improve the experience with MGSP.

### Setting the autostart
With following you can configure to autostart MGSP, it will also restart in case of an error:

```
sudo docker update --restart unless-stopped MGSP
```

### Configuring the timezone
Since MGSP logs certain things, and appends a timestamp, it can be useful to set the correct timezone.\
You can do this by running following command, and following the interactive prompt.
```
sudo docker exec -it MGSP dpkg-reconfigure tzdata
```

### Setting connection-throttle
The destination hosts may need to have the bukkit.yml edited and `connection-throttle` set to `-1`.\
Since every player connects from the same proxy, the server might throttle players because of this.

# Example servers.json
To run MGSP you need to configure a servers.json file, you can add as many hosts as you'd like.\
Keep in mind that if the file is invalid, MGSP can not start.

```JSON
{
    "hosts": [
        {
            "name": "host A",
            "address": "hostA.example.com",
            "target": "192.168.0.5:25591"
        },
        {
            "name": "host B",
            "address": "hostB.example.com",
            "target": "192.168.0.5:25590"
        }
    ]
}
```

MGSP can connect across the internet, as well as local networks to reach the desired Minecraft servers.

## Special settings
### serverStatus
One may overwrite the status message reported from a server by using `serverStatus`:

```json
{
    "hosts": [
        {
            "name": "host A",
            "address": "hostA.example.com",
            "target": "192.168.0.5:25591",
            "serverStatus": "test.json"
        },
        ...
    ]
}
```

The test.json file has to be in the config/serverStatus folder.

You can also pass an array of different status files, which will result the proxy picking a random one when the client sends a refresh.

```json
{
    "hosts": [
        {
            ...
            "serverStatus": ["test.json", "test2.json", "test3.json"]
        },
        ...
    ]
}
```

### passthroughPlayerCount
This option enables the proxy to connect to the target host, it will pretend to be a Minecraft client and retrieve the server status in real-time. It will take the player count and max player count from the real server and mask the file from `serverStatus`. This has no effect when `serverStatus` is not specified.

In normal cases this doesn't have to be specified because the proxy will get the information from the target host directly when `serverStatus` is not used.

If you don't pass this option, then the player count inside of the server status file is reported.

Example:
```json
{
    "hosts": [
        {
            "name": "host A",
            "address": "hostA.example.com",
            "target": "192.168.0.5:25591",
            "serverStatus": "test.json",
            "passthroughPlayerCount": true
        },
        ...
    ]
}
```

## Other status files
You can configure the standard messages by editing the config/serverStatus files.\
These can also be disabled through `settings.json`.

# Settings
You can configure the global behavior of MGSP in `settings.json`.

### max-concurrent-connections
This option takes a number which is the equivalent of how many hosts can be connected at the same time from a remoteAddress.\
20 is the default value, setting it too low can cause issues when too many players play from the same network.

This option is an anti DOS feature which prevents someone from sending too many tcp requests from the same address, this is not a ddos protection.

### ping-on-proxy-visibility
The default value for this is true, it allows the client to measure the ping to the server.\
When no remote host is available, it'll show the ping to the proxy.

### server-offline-visibility
When a server times out on the proxy-side it will show an error message directly in the server browser.\
This options is also enabled by default. When set to false, the client will not receive any information and the connection will just end.

### server-offline-status
With this option you can specify which json-file you want to use from the serverStatus folder. This setting has no effect when `server-offline-visibility` is set to false.\
This can be a string or an array of status files.

### server-not-found-visibility
This option makes any unknown host to the server be responded with a standard not-found message. This is toggled on by default. If you don't want your proxy to respond to every request, then you should toggle this off.

### server-not-found-status
The status file for the not found message, when a domain points to your server. This option has no effect when `server-not-found-status-enabled` is toggled off.\
This can be a string or an array of status files.

### auto-complete-passthrough-server-status
This option is enabled by default, it will take place when a host in the servers.json uses `passthroughPlayerCount`.\
It allows missing keys from your server status file to be autofilled by the original server status file from the remote target.

### hide-max-concurrent-connections-message
This option hides the message that appears when someone reached the max-concurrent-connections limitation.\
It is set to `true` by default, if you require this option, set it to `false`.

# Other
## genfavico
This image comes bundled with `genfavico` which should help generating a valid base64 image string compatible with SLP.\
Keep in mind this image has to be 64x64.

To use it simply move your PNG file into /app/config/ or your bind-folder, then run:
```shell
sudo docker exec MGSP genfavico /app/config/my-logo.png
```

## getmotd
You can retrieve the JSON of a Minecraft server using the `getmotd` command.

The Port is optional.

Here's an example command:
```shell
sudo docker exec MGSP getmotd myServer.example.com:25566
```

The string should appear in the console.
