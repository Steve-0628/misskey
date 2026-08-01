ARG NODE_VERSION=24.18.0-trixie

FROM node:${NODE_VERSION} AS native-builder

RUN apt-get update
RUN apt-get install -yqq --no-install-recommends build-essential

RUN corepack enable

WORKDIR /misskey

COPY --link ["pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json", "./"]
COPY --link ["scripts", "./scripts"]
COPY --link ["packages/backend/package.json", "./packages/backend/"]
COPY --link ["packages/frontend/package.json", "./packages/frontend/"]
COPY --link ["packages/misskey-js/package.json", "./packages/misskey-js/"]

RUN pnpm i --frozen-lockfile --aggregate-output

COPY --link . ./

ARG NODE_ENV=production

RUN git submodule update --init
RUN pnpm build
RUN rm -rf .git/

# build native dependencies for target platform

FROM node:${NODE_VERSION} AS target-builder

RUN apt-get update \
	&& apt-get install -yqq --no-install-recommends \
	build-essential

RUN corepack enable

WORKDIR /misskey

COPY --link ["pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json", "./"]
COPY --link ["scripts", "./scripts"]
COPY --link ["packages/backend/package.json", "./packages/backend/"]

RUN pnpm i --frozen-lockfile --aggregate-output

FROM node:${NODE_VERSION}-slim AS runner

ARG UID="991"
ARG GID="991"

RUN apt-get update
RUN apt-get install -y --no-install-recommends ffmpeg tini curl
RUN corepack enable

RUN groupadd -g "${GID}" misskey
RUN useradd -l -u "${UID}" -g "${GID}" -m -d /misskey misskey

USER misskey
WORKDIR /misskey

COPY --chown=misskey:misskey . ./
COPY --chown=misskey:misskey --from=target-builder /misskey/node_modules ./node_modules
COPY --chown=misskey:misskey --from=target-builder /misskey/packages/backend/node_modules ./packages/backend/node_modules
COPY --chown=misskey:misskey --from=native-builder /misskey/built ./built
COPY --chown=misskey:misskey --from=native-builder /misskey/packages/backend/built ./packages/backend/built
COPY --chown=misskey:misskey --from=native-builder /misskey/fluent-emojis /misskey/fluent-emojis

ENV NODE_ENV=production
HEALTHCHECK --interval=5s --retries=20 CMD ["/bin/bash", "/misskey/healthcheck.sh"]
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/bin/bash", "-c", "cd /misskey/packages/backend && node ./node_modules/typeorm/cli.js migration:run -d ormconfig.js && node ./check_connect.js && exec node ./built/boot/index.js"]
