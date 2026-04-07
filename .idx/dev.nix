# To learn more about how to use Nix to configure your environment
# see: https://firebase.google.com/docs/studio/customize-workspace
{ pkgs, ... }: {
  channel = "stable-24.05";

  packages = [
    pkgs.bubblewrap
    pkgs.nodejs_22
  ];

  env = {};
  idx = {
    extensions = [
      # "vscodevim.vim"
    ];

    previews = {
      enable = true;
      previews = {};
    };

    workspace = {
      onCreate = {
        npm-install = "npm install";
      };
      onStart = {};
    };
  };
}
