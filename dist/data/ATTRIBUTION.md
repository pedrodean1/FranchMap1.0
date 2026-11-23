# Cartografía de FranchMap

La cartografía local deriva de datos de dominio público del U.S. Census Bureau, sin afiliación ni aval de esa entidad.

- **Mapa base.** TIGER/Line 2024. Carreteras, hidrografía, puntos interiores de localidades, parques y aeropuertos seleccionados de Miami-Dade y Broward. Las geometrías están recortadas y simplificadas para su visualización. La clasificación de carreteras se basa en MTFCC. Se omiten calles menores y cuerpos de agua pequeños. [Fuente](https://www2.census.gov/geo/tiger/TIGER2024/).
- **Ciudades y localidades censales (CDP).** TIGER/Line 2024, límites de lugares de Florida. Incluye localidades con al menos un 10 % de su superficie en uno de los dos condados. [Fuente](https://www2.census.gov/geo/tiger/TIGER2024/PLACE/tl_2024_12_place.zip).
- **ZIP.** Límites generalizados ZCTA 2020 a escala 1:500.000. Las ZCTA aproximan zonas de entrega postal. Algunos ZIP, incluidos los exclusivos de apartados postales, carecen de un polígono equivalente. [Fuente](https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip).
- **Condados.** Límites cartográficos generalizados 2024, escala 1:500.000. [Fuente](https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_county_500k.zip).

Los archivos GeoJSON usan coordenadas geográficas en orden longitud, latitud. Las posiciones de etiquetas proceden de puntos interiores censales y no representan ayuntamientos o centros comerciales. Los límites políticos y postales son referencias de búsqueda. Los territorios comerciales requieren confirmación de la franquicia.
