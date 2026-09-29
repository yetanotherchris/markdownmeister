FROM mcr.microsoft.com/playwright:v1.62.1-noble
RUN npm install --prefix /opt/node22 node@22.23.3
RUN npm install --prefix /opt/npm10 npm@10.9.4
RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-bin && rm -rf /var/lib/apt/lists/*
ENV PATH="/opt/npm10/node_modules/.bin:/opt/node22/node_modules/node/bin:${PATH}"
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
RUN chown pwuser:pwuser /workspace
COPY --chown=pwuser:pwuser src/ src/
COPY --chown=pwuser:pwuser tests/ tests/
COPY --chown=pwuser:pwuser assets/ assets/
COPY --chown=pwuser:pwuser resources/ resources/
COPY --chown=pwuser:pwuser native/ native/
COPY --chown=pwuser:pwuser scripts/ scripts/
COPY --chown=pwuser:pwuser electron.vite.config.ts playwright.config.ts ./
COPY --chown=pwuser:pwuser tsconfig*.json ./
USER pwuser
ENV HOME=/home/pwuser
