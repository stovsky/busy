import 'firebase/firestore'
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api'
import { firestore } from 'utils/firebase'
import { submitRatingToDatabase, checkExpired } from 'utils/ratings'
import {
  Autocomplete,
  TextField,
  FormGroup,
  Checkbox,
  FormControlLabel,
  FormControl,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  Rating,
  CircularProgress,
  Box,
  Typography,
  ThemeProvider,
  Stack,
  Divider,
} from '@mui/material'
import { Close } from '@mui/icons-material'
import { useRef, useCallback, useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { getClosestPlaces, retrievePlacesByName } from 'utils/places'
import { createTheme } from '@mui/material/styles'
import { getIcon } from 'assets'
import styles from './dashboard.module.scss'

const theme = createTheme({
  palette: {
    hot: {
      main: '#f00e21',
    },
    medium: {
      main: '#FF8A00',
    },
    cold: {
      main: '#BDD70E',
    },
  },
})

const libraries = ['places']
const mapContainerStyle = {
  width: '100%',
  height: '100%',
}
const center = {
  lat: 34.0689,
  lng: -118.4452,
}

const options = {
  maxZoom: 20,
  streetViewControl: false,
  clickableIcons: false,
}

const Dashboard = () => {
  const { me } = useSelector((state) => state.app)

  const [searchValue, setSearchValue] = useState('')
  const [data, setData] = useState([])
  const [initialData, setInitialData] = useState([])
  const [categories, setCategories] = useState([
    'restaurant',
    'bar',
    'gym',
    'library',
  ])
  const [selectedMarker, setSelectedMarker] = useState(null)
  const [rating, setRating] = useState(null)

  useEffect(() => {
    firestore.collection('places').onSnapshot((querySnapshot) => {
      setData([])
      querySnapshot.forEach((doc) => {
        const place = doc.data()
        setData((prev) => [...prev, place])
      })
    })

    getClosestPlaces([center.lat, center.lng], initialData, setInitialData)
    checkExpired()
  }, [])

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries,
  })

  const mapRef = useRef()
  const onMapLoad = useCallback((map) => {
    mapRef.current = map
  }, [])

  useEffect(() => {
    if (searchValue !== '') {
      retrievePlacesByName(searchValue).then((place) => {
        mapRef.current.panTo({
          lat: place.location._lat,
          lng: place.location._long,
        })
        mapRef.current.setZoom(20)
        getClosestPlaces(
          [place.location._lat, place.location._long],
          initialData,
          setInitialData,
        )
      })
    }
  }, [searchValue])

  useEffect(() => {
    if (rating) {
      submitRatingToDatabase(selectedMarker.id, me?.id, rating)
    }
  }, [rating])

  if (loadError) return 'Error loading maps.'
  if (!isLoaded) return 'Loading...'

  const handleCheckboxClick = (label) => {
    if (categories.includes(label)) {
      const idx = categories.indexOf(label)
      setCategories([
        ...categories.slice(0, idx),
        ...categories.slice(idx + 1, categories.length),
      ])
    } else {
      setCategories([...categories, label])
    }
  }
  const getData = (place) => data.find((obj) => obj.id === place.id)

  const getColor = (place) => {
    const selected = getData(place)
    if (!selected) return 'hot'
    if (selected.rating >= 1 && selected.rating < 2.333) return 'cold'
    if (selected.rating >= 2.333 && selected.rating < 3.666) return 'medium'
    return 'hot'
  }

  const openDialog = () => (
    <Dialog open onClose={() => setSelectedMarker(null)} maxWidth="sm">
      <DialogContent>
        <Stack alignItems="center" spacing={1}>
          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <ThemeProvider theme={theme}>
              <CircularProgress
                color={getColor(selectedMarker)}
                size="5rem"
                variant="determinate"
                value={
                  getData(selectedMarker) &&
                  ((getData(selectedMarker).rating - 1) * 100) / 4 !== 0
                    ? ((getData(selectedMarker).rating - 1) * 100) / 4
                    : 5
                }
              />
            </ThemeProvider>
            <Box
              sx={{
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography color="black" fontSize="1.5rem">
                {getData(selectedMarker)
                  ? getData(selectedMarker).rating.toPrecision(2)
                  : null}
              </Typography>
            </Box>
          </Box>
          <Typography variant="h5">{selectedMarker.name}</Typography>
          <Divider flexItem />
          <Typography>How busy?</Typography>
          <Rating
            value={rating}
            onChange={(event, newRating) => setRating(newRating)}
          />
          <Typography>
            {getData(selectedMarker)
              ? `Score based on ${getData(selectedMarker).users} ${
                  getData(selectedMarker).users === 1 ? 'user' : 'users'
                }`
              : null}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <IconButton
          aria-label="close"
          onClick={() => setSelectedMarker(null)}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
          }}
        >
          <Close />
        </IconButton>
      </DialogActions>
    </Dialog>
  )

  return (
    <div className={styles.root}>
      <div className={styles.container}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          zoom={15}
          center={center}
          onLoad={onMapLoad}
          onClick={() => setSelectedMarker(null)}
          options={options}
        >
          {initialData.map((place) => (
            <Marker
              visible={place.types.some((r) => categories.includes(r))}
              icon={getIcon(data.find((obj) => obj.id === place.id))}
              animation={window.google.maps.Animation.DROP}
              key={place.id}
              position={{ lat: place.location._lat, lng: place.location._long }}
              onClick={() => {
                setSelectedMarker(data.find((obj) => obj.id === place.id))
              }}
            />
          ))}
          {selectedMarker ? openDialog() : null}

          <FormControl
            style={{
              position: 'absolute',
              left: '1.5%',
              top: '8%',
              backgroundColor: 'white',
              padding: '0 10px',
              borderRadius: '3px',
              boxSizing: `border-box`,
              border: `1px solid transparent`,
              boxShadow: `0 2px 6px rgba(0, 0, 0, 0.3)`,
            }}
          >
            <FormGroup>
              <FormControlLabel
                control={<Checkbox defaultChecked />}
                label="Restaurant"
                onChange={() => handleCheckboxClick('restaurant')}
                style={{ color: 'black' }}
              />
              <FormControlLabel
                control={<Checkbox defaultChecked />}
                label="Bar"
                onChange={() => handleCheckboxClick('bar')}
                style={{ color: 'black' }}
              />
              <FormControlLabel
                control={<Checkbox defaultChecked />}
                label="Gym"
                onChange={() => handleCheckboxClick('gym')}
                style={{ color: 'black' }}
              />
              <FormControlLabel
                control={<Checkbox defaultChecked />}
                label="Library"
                onChange={() => handleCheckboxClick('library')}
                style={{ color: 'black' }}
              />
            </FormGroup>
          </FormControl>

          <Autocomplete
            freeSolo
            id="search-bar"
            options={data.map((place) => place.name)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search for a place"
                variant="outlined"
                style={{
                  backgroundColor: 'white',
                  width: '30%',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  paddingBottom: 0,
                  marginTop: 0,
                  left: '35%',
                  top: '2%',
                  position: 'absolute',
                }}
              />
            )}
            value={searchValue}
            onChange={(event, newSearchValue) => setSearchValue(newSearchValue)}
          />
        </GoogleMap>
      </div>
    </div>
  )
}

Dashboard.propTypes = {}
Dashboard.defaultProps = {}

export default Dashboard
