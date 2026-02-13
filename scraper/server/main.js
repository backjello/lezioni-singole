const url = "https://hades.subito.it/v1/search/items?q=vespa&c=3&t=s&qso=false&ndo=false&shp=false&urg=false&sort=datedesc&lim=30&start=0"
async function main() {
    const response = await fetch(url);
    const data = await response.json();
    console.log(data);
}
main();